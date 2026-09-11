import { chromium } from 'playwright';
import fs from 'fs';

const id = '7338051897175117075';
const url = `https://www.douyin.com/note/${id}`;

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

const network = new Map();

page.on('response', async response => {
    try {
        const req = response.request();
        const u = response.url();

        const headers = response.headers();

        const ct =
            (headers['content-type'] || '')
                .toLowerCase();

        const type =
            req.resourceType();

        const looksMedia =
            type === 'media' ||
            type === 'image' ||
            ct.startsWith('image/') ||
            ct.startsWith('video/') ||
            /\.mp4(?:\?|$)/i.test(u) ||
            /\.mov(?:\?|$)/i.test(u) ||
            /aweme-images/i.test(u) ||
            /imagex/i.test(u) ||
            /douyinpic/i.test(u) ||
            /tos-cn/i.test(u) ||
            /byteimg/i.test(u);

        if (!looksMedia) {
            return;
        }

        network.set(u, {
            url: u,
            status: response.status(),
            type,
            contentType: ct,
            contentLength:
                headers['content-length'] || ''
        });

    } catch {}
});

console.log('打开:', url);

await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
});

await page.waitForTimeout(8000);

async function interactWithMainMedia() {
    const imgs =
        await page.locator('img').elementHandles();

    let best = null;
    let bestArea = 0;

    for (const img of imgs) {
        try {
            const box =
                await img.boundingBox();

            if (!box) continue;

            const area =
                box.width * box.height;

            if (
                box.width > 250 &&
                box.height > 250 &&
                area > bestArea
            ) {
                bestArea = area;
                best = box;
            }

        } catch {}
    }

    if (!best) {
        return;
    }

    const x =
        best.x + best.width / 2;

    const y =
        best.y + best.height / 2;

    await page.mouse.move(x, y);

    // Hover 一段时间，很多网页版 Live Photo 会在这里加载 motion
    await page.waitForTimeout(1800);

    // 再模拟短暂按住，防止网页用 press 才加载视频
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();

    await page.waitForTimeout(1200);
}

// 连续遍历多张
for (let i = 0; i < 8; i++) {
    console.log('扫描第', i + 1, '页');

    await interactWithMainMedia();

    await page.keyboard.press('ArrowRight')
        .catch(() => {});

    await page.waitForTimeout(1200);
}

// 再滚动一下，触发懒加载
await page.mouse.wheel(0, 500);
await page.waitForTimeout(2000);

// ======================================================
// DOM 图片
// ======================================================

const domImages =
    await page.evaluate(() => {
        return [...document.images]
            .map(img => ({
                src:
                    img.currentSrc ||
                    img.src ||
                    '',

                width:
                    img.naturalWidth || 0,

                height:
                    img.naturalHeight || 0,

                clientWidth:
                    img.clientWidth || 0,

                clientHeight:
                    img.clientHeight || 0
            }))
            .filter(x =>
                x.src &&
                x.width >= 400 &&
                x.height >= 400
            );
    });

// ======================================================
// DOM 视频
// ======================================================

const domVideos =
    await page.evaluate(() => {
        return [...document.querySelectorAll('video')]
            .map(v => ({
                src:
                    v.currentSrc ||
                    v.src ||
                    '',

                poster:
                    v.poster || '',

                width:
                    v.videoWidth || 0,

                height:
                    v.videoHeight || 0,

                readyState:
                    v.readyState,

                paused:
                    v.paused,

                sources:
                    [...v.querySelectorAll('source')]
                        .map(x => x.src)
                        .filter(Boolean)
            }));
    });

// ======================================================
// Performance resource entries
// ======================================================

const perf =
    await page.evaluate(() => {
        return performance
            .getEntriesByType('resource')
            .map(x => ({
                url: x.name,
                initiatorType:
                    x.initiatorType
            }))
            .filter(x =>
                /mp4|mov|video|play|tos-cn|aweme-images|imagex|byteimg/i
                    .test(x.url)
            );
    });

const networkItems =
    [...network.values()];

// 视频候选
const videoCandidates =
    networkItems.filter(x =>
        x.type === 'media' ||
        x.contentType.startsWith('video/') ||
        /\.mp4(?:\?|$)/i.test(x.url) ||
        /\/video\//i.test(x.url) ||
        /play_addr/i.test(x.url)
    );

// 图片候选
const imageCandidates =
    networkItems.filter(x =>
        x.type === 'image' ||
        x.contentType.startsWith('image/')
    );

const output = {
    id,
    page: page.url(),
    title: await page.title(),

    domImages,
    domVideos,

    videoCandidates,
    imageCandidates,

    perf
};

fs.writeFileSync(
    '/tmp/douyin-media-candidates.json',
    JSON.stringify(output, null, 2)
);

console.log('\n==============================');
console.log('页面:', output.page);
console.log('标题:', output.title);

console.log('\nDOM 大图数量 =', domImages.length);

for (const x of domImages) {
    console.log(
        `IMAGE ${x.width}x${x.height}`,
        x.src
    );
}

console.log('\nDOM video 数量 =', domVideos.length);

for (const x of domVideos) {
    console.log(
        'VIDEO-DOM',
        x.width + 'x' + x.height,
        x.src || '(blob/空)',
        'poster=',
        x.poster || '(无)'
    );

    for (const s of x.sources) {
        console.log(
            '  SOURCE',
            s
        );
    }
}

console.log(
    '\n网络视频候选数量 =',
    videoCandidates.length
);

for (const x of videoCandidates) {
    console.log(
        'VIDEO-NET',
        x.status,
        x.type,
        x.contentType,
        x.url
    );
}

console.log(
    '\n网络图片候选数量 =',
    imageCandidates.length
);

for (const x of imageCandidates.slice(0, 40)) {
    console.log(
        'IMAGE-NET',
        x.status,
        x.contentType,
        x.url
    );
}

console.log(
    '\n完整结果：/tmp/douyin-media-candidates.json'
);

console.log('==============================');

await browser.close();
