import { chromium } from 'playwright';
import fs from 'fs';

const id = '7338051897175117075';
const url = `https://www.douyin.com/note/${id}`;

function getImages(obj) {
    if (!obj || typeof obj !== 'object') return [];

    const candidates = [
        obj?.image_post_info?.images,
        obj?.image_post_info?.image_list,
        obj?.images,
        obj?.image_list
    ];

    for (const x of candidates) {
        if (Array.isArray(x) && x.length) {
            return x;
        }
    }

    return [];
}

function candidateScore(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return -1;
    }

    const objId =
        obj.aweme_id ??
        obj.awemeId ??
        obj.awemeID ??
        '';

    if (String(objId) !== String(id)) {
        return -1;
    }

    let score = 0;

    const images = getImages(obj);

    if (images.length) {
        score += 500;
    }

    if (
        Number(obj.aweme_type) === 68 ||
        Number(obj.awemeType) === 68
    ) {
        score += 100;
    }

    if (
        Number(obj.is_live_photo) === 1 ||
        Number(obj.isLivePhoto) === 1
    ) {
        score += 100;
    }

    if (obj.video && typeof obj.video === 'object') {
        score += 50;
    }

    if (
        images.some(img =>
            img?.video ||
            img?.clip_video ||
            img?.video_info
        )
    ) {
        score += 300;
    }

    if (obj.desc || obj.author) {
        score += 10;
    }

    return score;
}

function findBest(root) {
    let best = null;
    let bestScore = -1;

    const seen = new Set();

    function walk(value, depth = 0) {
        if (
            value == null ||
            depth > 20
        ) {
            return;
        }

        if (typeof value !== 'object') {
            return;
        }

        if (seen.has(value)) {
            return;
        }

        seen.add(value);

        const score =
            candidateScore(value);

        if (score > bestScore) {
            bestScore = score;
            best = value;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                walk(item, depth + 1);
            }
        } else {
            for (const item of Object.values(value)) {
                walk(item, depth + 1);
            }
        }
    }

    walk(root);

    return {
        item: bestScore >= 50 ? best : null,
        score: bestScore
    };
}

function deepParse(value) {
    let v = value;

    for (let i = 0; i < 3; i++) {
        if (typeof v !== 'string') break;

        try {
            v = JSON.parse(v);
        } catch {
            break;
        }
    }

    return v;
}

function extractAssignedObject(text, marker) {
    const idx = text.indexOf(marker);

    if (idx < 0) return null;

    const eq = text.indexOf('=', idx);

    if (eq < 0) return null;

    let pos = eq + 1;

    while (
        pos < text.length &&
        /\s/.test(text[pos])
    ) {
        pos++;
    }

    if (text[pos] !== '{') {
        return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = pos; i < text.length; i++) {
        const c = text[i];

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (c === '\\') {
                escaped = true;
            } else if (c === '"') {
                inString = false;
            }

            continue;
        }

        if (c === '"') {
            inString = true;
            continue;
        }

        if (c === '{') depth++;
        if (c === '}') depth--;

        if (depth === 0) {
            const raw =
                text.slice(pos, i + 1);

            try {
                return JSON.parse(raw);
            } catch {
                return null;
            }
        }
    }

    return null;
}

function firstURL(container) {
    if (!container) return '';

    if (typeof container === 'string') {
        return container;
    }

    const lists = [
        container.url_list,
        container.urlList,
        container.origin_url_list,
        container.originURLList
    ];

    for (const list of lists) {
        if (Array.isArray(list)) {
            const hit = list.find(
                x =>
                    typeof x === 'string' &&
                    /^https?:\/\//.test(x)
            );

            if (hit) return hit;
        }
    }

    return '';
}

function imageURL(img) {
    const containers = [
        img?.watermark_free_download_url,
        img?.origin_image,
        img?.display_image,
        img,
        img?.download_image,
        img?.download_addr
    ];

    for (const x of containers) {
        const u = firstURL(x);

        if (u) return u;
    }

    return '';
}

function motionURL(img) {
    const video =
        img?.video ??
        img?.video_info ??
        img?.clip_video ??
        img?.motion ??
        null;

    if (!video) return '';

    const candidates = [
        video.play_addr_h264,
        video.play_addr,
        video.download_addr,
        video.bit_rate?.[0]?.play_addr,
        video.bit_rate?.[0]?.play_addr_h264,
        video.play_addr_265,
        video.play_addr_bytevc1
    ];

    for (const x of candidates) {
        const u = firstURL(x);

        if (u) return u;
    }

    return '';
}

let bestItem = null;
let bestScore = -1;
let bestSource = '';

function acceptCandidate(root, source) {
    const result = findBest(root);

    if (
        result.item &&
        result.score > bestScore
    ) {
        bestItem = result.item;
        bestScore = result.score;
        bestSource = source;

        console.log(
            `候选作品 score=${result.score} 来源=${source}`
        );
    }
}

const browser = await chromium.launch({
    headless: true
});

const context = await browser.newContext({
    viewport: {
        width: 1280,
        height: 900
    },

    locale: 'zh-CN',

    userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/124.0.0.0 Safari/537.36'
});

const page = await context.newPage();

const responseHits = [];
const pending = new Set();

async function inspectResponse(response) {
    const responseUrl = response.url();

    if (
        !responseUrl.includes('douyin') &&
        !responseUrl.includes('amemv') &&
        !responseUrl.includes('snssdk')
    ) {
        return;
    }

    let text = '';

    try {
        text = await response.text();
    } catch {
        return;
    }

    if (!text.includes(id)) {
        return;
    }

    const mediaSignal =
        text.includes('"image_post_info"') ||
        text.includes('"live_photo_type"') ||
        text.includes('"clip_type"') ||
        text.includes('"aweme_type"') ||
        text.includes('"images"') ||
        text.includes('"video"');

    responseHits.push({
        url: responseUrl,
        length: text.length,
        mediaSignal
    });

    if (!mediaSignal) return;

    try {
        const json =
            JSON.parse(
                text.replace(/^\uFEFF/, '')
            );

        acceptCandidate(
            json,
            `response:${responseUrl}`
        );

    } catch {}
}

page.on('response', response => {
    const p =
        inspectResponse(response)
            .finally(() => {
                pending.delete(p);
            });

    pending.add(p);
});

console.log('打开:', url);

await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
}).catch(e => {
    console.log(
        'goto警告:',
        e.message
    );
});

// 给页面足够时间跑完 JS 和 API
await page.waitForTimeout(15000);

// 轻微滚动，触发可能存在的懒加载
await page.mouse.wheel(0, 600);
await page.waitForTimeout(3000);

await Promise.allSettled(
    [...pending]
);

console.log(
    '\n最终页面:',
    page.url()
);

console.log(
    '页面标题:',
    await page.title()
);

// ==========================================================
// 1. 检查浏览器全局状态
// ==========================================================

const globals =
    await page.evaluate(() => {
        const names = [
            '_ROUTER_DATA',
            '__UNIVERSAL_DATA_FOR_REHYDRATION__',
            '__INITIAL_STATE__',
            '_SSR_DATA',
            'RENDER_DATA',
            '__INIT_PROPS__'
        ];

        const out = {};

        for (const name of names) {
            try {
                const value =
                    window[name];

                if (value !== undefined) {
                    out[name] =
                        JSON.stringify(value);
                }
            } catch {}
        }

        return out;
    });

for (
    const [name, raw]
    of Object.entries(globals)
) {
    try {
        const value =
            deepParse(raw);

        acceptCandidate(
            value,
            `window.${name}`
        );

        console.log(
            '发现全局状态:',
            name,
            '长度=',
            raw.length
        );

    } catch {}
}

// ==========================================================
// 2. 检查 script 标签里的 SSR / Router 数据
// ==========================================================

const scripts =
    await page
        .locator('script')
        .allTextContents();

console.log(
    'script数量 =',
    scripts.length
);

const markers = [
    'window._ROUTER_DATA',
    '_ROUTER_DATA',
    '__UNIVERSAL_DATA_FOR_REHYDRATION__',
    '__INITIAL_STATE__',
    '_SSR_DATA',
    'RENDER_DATA'
];

for (
    let index = 0;
    index < scripts.length;
    index++
) {
    const text = scripts[index];

    if (!text.includes(id)) {
        continue;
    }

    console.log(
        `script ${index} 包含目标ID，长度=${text.length}`
    );

    for (const marker of markers) {
        if (!text.includes(marker)) {
            continue;
        }

        const parsed =
            extractAssignedObject(
                text,
                marker
            );

        if (parsed) {
            acceptCandidate(
                parsed,
                `script:${index}:${marker}`
            );
        }
    }
}

// ==========================================================
// 3. 最后检查整个渲染后的 HTML
// ==========================================================

const html =
    await page.content();

fs.writeFileSync(
    '/tmp/douyin-note-rendered.html',
    html
);

console.log(
    '渲染HTML长度 =',
    html.length
);

console.log(
    'HTML包含目标ID =',
    html.includes(id)
);

console.log(
    'HTML包含 live_photo_type =',
    html.includes('live_photo_type')
);

console.log(
    'HTML包含 image_post_info =',
    html.includes('image_post_info')
);

// ==========================================================
// 输出真正媒体对象
// ==========================================================

console.log(
    '\n包含目标 ID 的响应：'
);

for (const x of responseHits) {
    console.log(
        x.mediaSignal ? 'MEDIA' : '-----',
        x.length,
        x.url
    );
}

if (!bestItem) {
    console.log(
        '\n❌ 尚未找到真正作品媒体对象'
    );

    console.log(
        '已保存 /tmp/douyin-note-rendered.html'
    );

    await browser.close();
    process.exit(2);
}

fs.writeFileSync(
    '/tmp/douyin-target.json',
    JSON.stringify(
        bestItem,
        null,
        2
    )
);

console.log(
    '\n================================='
);

console.log(
    '✅ 真正作品媒体对象已找到'
);

console.log(
    '来源 =',
    bestSource
);

console.log(
    'score =',
    bestScore
);

console.log(
    'aweme_id =',
    bestItem.aweme_id ??
    bestItem.awemeId
);

console.log(
    'aweme_type =',
    bestItem.aweme_type ??
    bestItem.awemeType
);

console.log(
    'is_live_photo =',
    bestItem.is_live_photo ??
    bestItem.isLivePhoto
);

console.log(
    'desc =',
    bestItem.desc ?? ''
);

const images =
    getImages(bestItem);

console.log(
    'images =',
    images.length
);

let liveCount = 0;

images.forEach((img, i) => {

    const imgURL =
        imageURL(img);

    const liveURL =
        motionURL(img);

    if (liveURL) {
        liveCount++;
    }

    console.log(
        `\n--- 第 ${i + 1} 张 ---`
    );

    console.log(
        'live_photo_type =',
        img?.live_photo_type
    );

    console.log(
        'clip_type =',
        img?.clip_type
    );

    console.log(
        '图片 =',
        imgURL || '无'
    );

    console.log(
        '动态视频 =',
        liveURL || '无'
    );
});

console.log(
    '\n实况数量 =',
    liveCount
);

console.log(
    '完整JSON = /tmp/douyin-target.json'
);

console.log(
    '================================='
);

await browser.close();
