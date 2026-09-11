import express from 'express';
import { chromium } from 'playwright';
import sharp from 'sharp';
import crypto from 'crypto';
import { Readable } from 'stream';
import { promisify } from 'util';
import { execFile } from 'child_process';

const execFileAsync = promisify(execFile);

const PORT = 8899;

// 你现在已经稳定的视频/普通图片接口
const OLD_DYYY =
    'https://crctdd97.pages.dev/api/dyyy?url=';

const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/124.0.0.0 Safari/537.36';

const app = express();
app.set('trust proxy', true);

app.use((req, res, next) => {
    res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
    );
    next();
});

// ---------------------------------------------------------
// 临时媒体映射
// DYYY 获取解析结果后会马上下载，所以 30 分钟足够。
// ---------------------------------------------------------

const mediaMap = new Map();

function createMedia(url, type, referer) {
    const token =
        crypto.randomBytes(12).toString('hex');

    mediaMap.set(token, {
        url,
        type,
        referer,
        expireAt:
            Date.now() + 30 * 60 * 1000
    });

    return token;
}

setInterval(() => {
    const now = Date.now();

    for (const [key, value] of mediaMap) {
        if (value.expireAt < now) {
            mediaMap.delete(key);
        }
    }
}, 5 * 60 * 1000).unref();

// ---------------------------------------------------------
// 浏览器
// ---------------------------------------------------------

let browserPromise = null;

async function getBrowser() {
    if (!browserPromise) {
        browserPromise =
            chromium.launch({
                headless: true
            });
    }

    try {
        return await browserPromise;
    } catch (e) {
        browserPromise =
            chromium.launch({
                headless: true
            });

        return browserPromise;
    }
}

// ---------------------------------------------------------
// 安全检查
// ---------------------------------------------------------

function validDouyinURL(raw) {
    try {
        const u = new URL(raw);

        return (
            u.protocol === 'https:' &&
            (
                u.hostname === 'v.douyin.com' ||
                u.hostname === 'www.douyin.com' ||
                u.hostname === 'douyin.com' ||
                u.hostname === 'www.iesdouyin.com' ||
                u.hostname === 'iesdouyin.com'
            )
        );
    } catch {
        return false;
    }
}

// ---------------------------------------------------------
// 短链接解析
//
// 你已经实际验证过 Ubuntu curl 能稳定得到：
// /note/7338051897175117075
// ---------------------------------------------------------

async function resolveURL(raw) {
    if (!validDouyinURL(raw)) {
        throw new Error('非法抖音链接');
    }

    if (!raw.includes('v.douyin.com')) {
        return raw;
    }

    const {
        stdout
    } = await execFileAsync(
        'curl',
        [
            '-LsS',
            '--max-time',
            '10',
            '-o',
            '/dev/null',
            '-w',
            '%{url_effective}',
            raw
        ],
        {
            timeout: 12000
        }
    );

    return stdout.trim() || raw;
}

function extractId(url) {
    const m =
        String(url)
            .match(
                /\/(?:note|video)\/(\d{17,20})/
            );

    return m ? m[1] : '';
}

// ---------------------------------------------------------
// 当前页面所有真正作品图片
// ---------------------------------------------------------

async function getOrderedImages(page) {
    return page.evaluate(() => {
        const result = [];
        const seen = new Set();

        for (
            const img
            of document.querySelectorAll('img')
        ) {
            const src =
                img.currentSrc ||
                img.src ||
                '';

            if (
                !src.includes('aweme-images')
            ) {
                continue;
            }

            if (
                img.naturalWidth < 600 ||
                img.naturalHeight < 600
            ) {
                continue;
            }

            if (!seen.has(src)) {
                seen.add(src);
                result.push(src);
            }
        }

        return result;
    });
}

// ---------------------------------------------------------
// 找当前可见的主图
// ---------------------------------------------------------

async function getActiveImage(page) {
    return page.evaluate(() => {
        let best = null;
        let bestArea = 0;

        for (
            const img
            of document.querySelectorAll('img')
        ) {
            const src =
                img.currentSrc ||
                img.src ||
                '';

            if (
                !src.includes('aweme-images')
            ) {
                continue;
            }

            const r =
                img.getBoundingClientRect();

            if (
                r.width < 250 ||
                r.height < 250
            ) {
                continue;
            }

            const left =
                Math.max(0, r.left);

            const top =
                Math.max(0, r.top);

            const right =
                Math.min(
                    window.innerWidth,
                    r.right
                );

            const bottom =
                Math.min(
                    window.innerHeight,
                    r.bottom
                );

            const area =
                Math.max(
                    0,
                    right - left
                ) *
                Math.max(
                    0,
                    bottom - top
                );

            if (area > bestArea) {
                bestArea = area;

                best = {
                    src,
                    x:
                        r.left +
                        r.width / 2,

                    y:
                        r.top +
                        r.height / 2,

                    left:
                        r.left,

                    top:
                        r.top,

                    right:
                        r.right,

                    bottom:
                        r.bottom
                };
            }
        }

        return best;
    });
}

// ---------------------------------------------------------
// 找与当前图片重叠的 motion video
// ---------------------------------------------------------

async function getActiveMotion(page, image) {
    return page.evaluate(image => {
        let best = '';
        let bestScore = 0;

        const videos =
            document.querySelectorAll(
                'video'
            );

        for (const video of videos) {
            const src =
                video.currentSrc ||
                video.src ||
                '';

            if (
                !src.includes(
                    'douyinvod.com'
                )
            ) {
                continue;
            }

            const r =
                video.getBoundingClientRect();

            if (
                r.width < 200 ||
                r.height < 200
            ) {
                continue;
            }

            const left =
                Math.max(
                    r.left,
                    image.left
                );

            const top =
                Math.max(
                    r.top,
                    image.top
                );

            const right =
                Math.min(
                    r.right,
                    image.right
                );

            const bottom =
                Math.min(
                    r.bottom,
                    image.bottom
                );

            const overlap =
                Math.max(
                    0,
                    right - left
                ) *
                Math.max(
                    0,
                    bottom - top
                );

            let score = overlap;

            if (!video.paused) {
                score += 1000000;
            }

            if (score > bestScore) {
                bestScore = score;
                best = src;
            }
        }

        return best;
    }, image);
}

// ---------------------------------------------------------
// Live Photo 浏览器解析
// ---------------------------------------------------------

async function parseLiveNote(finalURL) {
    const id =
        extractId(finalURL);

    if (!id) {
        throw new Error(
            '无法取得 note ID'
        );
    }

    const browser =
        await getBrowser();

    const context =
        await browser.newContext({
            viewport: {
                width: 1280,
                height: 900
            },

            locale: 'zh-CN',

            userAgent: UA
        });

    const page =
        await context.newPage();

    // 网络中出现的真实 douyinvod motion
    const motionEvents = [];
    const motionSet = new Set();

    page.on(
        'response',
        response => {
            try {
                const url =
                    response.url();

                const ct =
                    (
                        response
                            .headers()[
                            'content-type'
                        ] || ''
                    ).toLowerCase();

                if (
                    url.includes(
                        'douyinvod.com'
                    ) &&
                    ct.includes('video/mp4') &&
                    !motionSet.has(url)
                ) {
                    motionSet.add(url);
                    motionEvents.push(url);
                }

            } catch {}
        }
    );

    try {
        await page.goto(
            `https://www.douyin.com/note/${id}`,
            {
                waitUntil:
                    'domcontentloaded',

                timeout:
                    30000
            }
        );

        await page.waitForTimeout(
            6000
        );

        const title =
            await page.title();

        let images =
            await getOrderedImages(page);

        if (!images.length) {
            throw new Error(
                '浏览器未获取图集'
            );
        }

        console.log(
            `[Live] ${id} 图片=${images.length}`
        );

        const pairMap =
            new Map();

        const visited =
            new Set();

        // -------------------------------------------------
        // 逐页扫描
        // -------------------------------------------------

        const maxSteps =
            Math.min(
                images.length + 3,
                30
            );

        for (
            let i = 0;
            i < maxSteps;
            i++
        ) {
            const active =
                await getActiveImage(
                    page
                );

            if (!active) {
                await page
                    .keyboard
                    .press(
                        'ArrowRight'
                    );

                await page.waitForTimeout(
                    700
                );

                continue;
            }

            const imageURL =
                active.src;

            if (!visited.has(imageURL)) {
                const before =
                    motionEvents.length;

                await page.mouse.move(
                    Math.max(
                        1,
                        active.x
                    ),
                    Math.max(
                        1,
                        active.y
                    )
                );

                await page.waitForTimeout(
                    900
                );

                // 部分 Live Photo 需要 hover / press
                try {
                    await page.mouse.down();

                    await page.waitForTimeout(
                        350
                    );

                    await page.mouse.up();

                } catch {}

                await page.waitForTimeout(
                    700
                );

                let motion =
                    await getActiveMotion(
                        page,
                        active
                    );

                // 如果 DOM 虚拟化导致 video
                // 一闪而过，就使用本次交互新出现的请求
                if (
                    !motion &&
                    motionEvents.length > before
                ) {
                    motion =
                        motionEvents[
                            motionEvents.length -
                            1
                        ];
                }

                pairMap.set(
                    imageURL,
                    motion || ''
                );

                visited.add(
                    imageURL
                );

                console.log(
                    `[Live] ${visited.size}/${images.length}`,
                    motion
                        ? '实况'
                        : '静态'
                );
            }

            if (
                visited.size >=
                images.length
            ) {
                break;
            }

            const oldSrc =
                active.src;

            await page
                .keyboard
                .press(
                    'ArrowRight'
                );

            // 等待翻到下一张
            for (
                let w = 0;
                w < 12;
                w++
            ) {
                await page.waitForTimeout(
                    180
                );

                const now =
                    await getActiveImage(
                        page
                    );

                if (
                    now &&
                    now.src !== oldSrc
                ) {
                    break;
                }
            }
        }

        // 页面运行过程中可能又挂载了剩余图片
        images =
            await getOrderedImages(
                page
            );

        // -------------------------------------------------
        // 重要兜底：
        //
        // 纯实况作品：
        // 图片数量 == douyinvod motion 数量
        //
        // 这时可以按网页加载顺序一一配对。
        //
        // 你当前测试作品就是：
        // 6 images + 6 motion mp4。
        // -------------------------------------------------

        const uniqueMotion =
            [...new Set(motionEvents)];

        if (
            uniqueMotion.length ===
            images.length
        ) {
            let mappedCount = 0;

            for (const img of images) {
                if (pairMap.get(img)) {
                    mappedCount++;
                }
            }

            if (
                mappedCount <
                images.length
            ) {
                console.log(
                    '[Live] 使用纯实况顺序兜底'
                );

                images.forEach(
                    (img, index) => {
                        pairMap.set(
                            img,
                            uniqueMotion[
                                index
                            ] || ''
                        );
                    }
                );
            }
        }

        const liveVideos =
            images.map(
                img =>
                    pairMap.get(img) ||
                    ''
            );

        const liveCount =
            liveVideos.filter(
                Boolean
            ).length;

        console.log(
            `[Live] 最终 images=${images.length}, live=${liveCount}`
        );

        return {
            id,
            title,
            images,
            liveVideos,
            liveCount
        };

    } finally {
        await context.close();
    }
}

// ---------------------------------------------------------
// 调用你现在稳定的 Cloudflare API
// ---------------------------------------------------------

async function callOldAPI(rawURL) {
    const response =
        await fetch(
            OLD_DYYY +
            encodeURIComponent(rawURL),
            {
                headers: {
                    'User-Agent': UA,
                    'Accept':
                        'application/json'
                }
            }
        );

    const text =
        await response.text();

    let json;

    try {
        json =
            JSON.parse(
                text.replace(
                    /^\uFEFF/,
                    ''
                )
            );
    } catch {
        throw new Error(
            '旧接口返回非 JSON'
        );
    }

    return json;
}

// ---------------------------------------------------------
// 生成 DYYY 需要的服务器代理地址
// ---------------------------------------------------------

function makeLiveResponse(
    req,
    parsed,
    finalURL
) {
    const proto =
        req.get(
            'x-forwarded-proto'
        ) ||
        req.protocol ||
        'http';

    const base =
        `${proto}://${req.get('host')}`;

    const images = [];
    const liveVideos = [];
    const videoList = [];

    parsed.images.forEach(
        (imageURL, index) => {
            const imageToken =
                createMedia(
                    imageURL,
                    'image',
                    finalURL
                );

            const imageProxy =
                `${base}/media/image/` +
                `${parsed.id}_${index + 1}_${imageToken}.jpg`;

            images.push(
                imageProxy
            );

            const motion =
                parsed.liveVideos[
                    index
                ] || '';

            let liveProxy = '';

            if (motion) {
                const videoToken =
                    createMedia(
                        motion,
                        'video',
                        finalURL
                    );

                liveProxy =
                    `${base}/media/live/` +
                    `${parsed.id}_${index + 1}_${videoToken}.mp4`;
            }

            liveVideos.push(
                liveProxy
            );

            videoList.push({
                url:
                    liveProxy ||
                    imageProxy,

                level:
                    liveProxy
                        ? `实况图片 ${index + 1}`
                        : `图片 ${index + 1}`
            });
        }
    );

    return {
        code: 0,
        msg: 'success',

        data: {
            images,
            live_videos:
                liveVideos,

            video_list:
                videoList,

            title:
                parsed.title,

            item_id:
                parsed.id
        }
    };
}

// ---------------------------------------------------------
// 主 DYYY API
// ---------------------------------------------------------

app.get(
    '/api/dyyy',
    async (req, res) => {
        const rawURL =
            String(
                req.query.url || ''
            ).trim();

        if (!validDouyinURL(rawURL)) {
            return res.status(400).json({
                code: -1,
                msg: '无效抖音链接'
            });
        }

        try {
            const finalURL =
                await resolveURL(
                    rawURL
                );

            console.log(
                '[DYYY]',
                rawURL,
                '=>',
                finalURL
            );

            // ---------------------------------------------
            // note：
            // 先检查浏览器 Live Photo
            // ---------------------------------------------

            if (
                /\/note\/\d+/.test(
                    finalURL
                )
            ) {
                try {
                    const parsed =
                        await parseLiveNote(
                            finalURL
                        );

                    // 至少检测到一张实况
                    if (
                        parsed.liveCount >
                        0
                    ) {
                        return res.json(
                            makeLiveResponse(
                                req,
                                parsed,
                                finalURL
                            )
                        );
                    }

                    console.log(
                        '[DYYY] 普通图文，回旧接口'
                    );

                } catch (e) {
                    console.warn(
                        '[DYYY] 浏览器实况解析失败:',
                        e.message
                    );
                }
            }

            // ---------------------------------------------
            // 普通视频 / 普通图片：
            // 完全使用你现在已经稳定的接口
            // ---------------------------------------------

            const oldResult =
                await callOldAPI(
                    rawURL
                );

            return res.json(
                oldResult
            );

        } catch (e) {
            console.error(
                '[DYYY]',
                e
            );

            return res
                .status(500)
                .json({
                    code: -1,
                    msg:
                        e.message ||
                        '解析失败'
                });
        }
    }
);

// ---------------------------------------------------------
// JPEG 代理
//
// 网页拿到的是 WebP。
// DYYY/iOS 之前已经验证 JPEG 更稳，
// 所以这里真正转换成 JPEG。
// ---------------------------------------------------------

app.get(
    '/media/image/:name',
    async (req, res) => {
        try {
            const m =
                req.params.name.match(
                    /_([0-9a-f]{24})\.jpg$/i
                );

            if (!m) {
                return res.sendStatus(
                    404
                );
            }

            const info =
                mediaMap.get(
                    m[1]
                );

            if (
                !info ||
                info.type !== 'image'
            ) {
                return res.sendStatus(
                    404
                );
            }

            const upstream =
                await fetch(
                    info.url,
                    {
                        headers: {
                            'User-Agent':
                                UA,

                            'Referer':
                                info.referer,

                            'Accept':
                                'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
                        }
                    }
                );

            if (!upstream.ok) {
                return res
                    .status(502)
                    .send(
                        'image upstream error'
                    );
            }

            const input =
                Buffer.from(
                    await upstream
                        .arrayBuffer()
                );

            const jpeg =
                await sharp(input)
                    .jpeg({
                        quality: 95
                    })
                    .toBuffer();

            res.setHeader(
                'Content-Type',
                'image/jpeg'
            );

            res.setHeader(
                'Content-Length',
                jpeg.length
            );

            res.setHeader(
                'Cache-Control',
                'private, max-age=600'
            );

            return res.end(
                jpeg
            );

        } catch (e) {
            console.error(
                '[image proxy]',
                e
            );

            return res.sendStatus(
                500
            );
        }
    }
);

// ---------------------------------------------------------
// Live motion MP4 代理
// 支持 Range。
// ---------------------------------------------------------

app.get(
    '/media/live/:name',
    async (req, res) => {
        try {
            const m =
                req.params.name.match(
                    /_([0-9a-f]{24})\.mp4$/i
                );

            if (!m) {
                return res.sendStatus(
                    404
                );
            }

            const info =
                mediaMap.get(
                    m[1]
                );

            if (
                !info ||
                info.type !== 'video'
            ) {
                return res.sendStatus(
                    404
                );
            }

            const headers = {
                'User-Agent':
                    UA,

                'Referer':
                    info.referer,

                'Accept':
                    '*/*',

                'Accept-Encoding':
                    'identity'
            };

            if (req.headers.range) {
                headers.Range =
                    req.headers.range;
            }

            const upstream =
                await fetch(
                    info.url,
                    {
                        headers
                    }
                );

            res.status(
                upstream.status
            );

            const passHeaders = [
                'content-length',
                'content-range',
                'accept-ranges',
                'etag',
                'last-modified'
            ];

            for (
                const key
                of passHeaders
            ) {
                const value =
                    upstream
                        .headers
                        .get(key);

                if (value) {
                    res.setHeader(
                        key,
                        value
                    );
                }
            }

            res.setHeader(
                'Content-Type',
                'video/mp4'
            );

            res.setHeader(
                'Accept-Ranges',
                'bytes'
            );

            res.setHeader(
                'Cache-Control',
                'private, max-age=600'
            );

            if (!upstream.body) {
                return res.end();
            }

            Readable
                .fromWeb(
                    upstream.body
                )
                .pipe(res);

        } catch (e) {
            console.error(
                '[video proxy]',
                e
            );

            if (!res.headersSent) {
                res.sendStatus(500);
            }
        }
    }
);

app.get(
    '/health',
    (req, res) => {
        res.json({
            ok: true,
            service:
                'dy-live-server'
        });
    }
);

app.listen(
    PORT,
    '127.0.0.1',
    () => {
        console.log(
            `DYYY Live API: http://127.0.0.1:${PORT}`
        );
    }
);
