import { chromium } from 'playwright';

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

let target = null;
let hits = [];

function findAweme(value, depth = 0) {
    if (!value || depth > 12) return null;

    if (Array.isArray(value)) {
        for (const x of value) {
            const r = findAweme(x, depth + 1);
            if (r) return r;
        }
        return null;
    }

    if (typeof value !== 'object') return null;

    const itemId =
        value.aweme_id ??
        value.awemeId ??
        value.awemeID;

    if (String(itemId || '') === id) {
        return value;
    }

    for (const v of Object.values(value)) {
        const r = findAweme(v, depth + 1);
        if (r) return r;
    }

    return null;
}

page.on('response', async response => {
    if (target) return;

    const responseUrl = response.url();

    if (
        !responseUrl.includes('douyin') &&
        !responseUrl.includes('amemv') &&
        !responseUrl.includes('snssdk')
    ) {
        return;
    }

    const ct =
        response.headers()['content-type'] || '';

    if (
        !ct.includes('json') &&
        !responseUrl.includes('/aweme/')
    ) {
        return;
    }

    try {
        const text = await response.text();

        if (!text.includes(id)) {
            return;
        }

        hits.push({
            url: responseUrl,
            length: text.length
        });

        let json;

        try {
            json = JSON.parse(text);
        } catch {
            return;
        }

        const item =
            findAweme(json);

        if (item) {
            target = item;

            console.log(
                '\n✅ 捕获到目标作品'
            );

            console.log(
                '来源:',
                responseUrl
            );
        }

    } catch {}
});

console.log('打开:', url);

await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 30000
}).catch(e => {
    console.log(
        'goto:',
        e.message
    );
});

await page.waitForTimeout(12000);

console.log(
    '\n最终页面:',
    page.url()
);

console.log(
    '页面标题:',
    await page.title()
);

console.log(
    '\n匹配到的网络响应:',
    hits
);

if (!target) {
    console.log(
        '\n❌ 浏览器暂时没有捕获到目标作品 JSON'
    );

    await page.screenshot({
        path:
            '/tmp/douyin-live-test.png',
        fullPage: false
    });

    console.log(
        '截图已保存: /tmp/douyin-live-test.png'
    );

    await browser.close();
    process.exit(2);
}

console.log(
    '\naweme_id =',
    target.aweme_id
);

console.log(
    'aweme_type =',
    target.aweme_type
);

console.log(
    'is_live_photo =',
    target.is_live_photo
);

const images =
    target.images ??
    target.image_post_info?.images ??
    target.image_post_info?.image_list ??
    [];

console.log(
    'images =',
    images.length
);

images.forEach((img, i) => {
    console.log(
        `\n--- 第 ${i + 1} 张 ---`
    );

    console.log(
        'live_photo_type =',
        img.live_photo_type
    );

    console.log(
        'clip_type =',
        img.clip_type
    );

    console.log(
        'has video =',
        !!img.video
    );

    const play =
        img.video?.play_addr_h264 ??
        img.video?.play_addr ??
        img.video?.bit_rate?.[0]?.play_addr;

    const urls =
        play?.url_list ??
        [];

    console.log(
        'motion urls =',
        urls.length
    );

    if (urls.length) {
        console.log(
            urls[0]
        );
    }
});

await browser.close();
