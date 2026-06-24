// ============================================================
// 重庆-丰都旅游攻略 - Cloudflare Workers 
// ============================================================

const GITHUB_BASE = 'https://raw.githubusercontent.com/tuboshu5418/chongqing-travel-images/main';
const AMAP_URI_BASE = 'https://uri.amap.com/marker';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}

function handleOptions() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        if (method === 'OPTIONS') {
            return handleOptions();
        }

        const db = env['travel_data'];

        // ============================================================
        // 1. 处理所有 API 请求
        // ============================================================
        if (path.startsWith('/api/')) {
            // ---- 高德导航链接 ----
            if (path === '/api/amap-link') {
                const params = url.searchParams;
                const lng = params.get('lng');
                const lat = params.get('lat');
                const name = params.get('name') || '目的地';
                if (!lng || !lat) {
                    return jsonResponse({ error: '缺少经纬度参数' }, 400);
                }
                return jsonResponse({
                    link: `${AMAP_URI_BASE}?position=${lng},${lat}&name=${encodeURIComponent(name)}`
                });
            }

            // ---- 图片Base URL ----
            if (path === '/api/images/base') {
                return jsonResponse({ github: GITHUB_BASE });
            }

            // ---- 行程API ----
            if (path.startsWith('/api/itinerary')) {
                const parts = path.split('/');
                const dayParam = parts[parts.length - 1];
                const dayNumber = parseInt(dayParam);

                if (method === 'GET') {
                    try {
                        if (!isNaN(dayNumber) && dayNumber > 0) {
                            const result = await db.prepare(
                                'SELECT * FROM itinerary WHERE day = ?'
                            ).bind(dayNumber).first();

                            if (!result) {
                                return jsonResponse({ error: `Day ${dayNumber} not found` }, 404);
                            }

                            if (result.schedule) result.schedule = JSON.parse(result.schedule);
                            if (result.places) result.places = JSON.parse(result.places);
                            return jsonResponse(result);
                        }

                        const { results } = await db.prepare(
                            'SELECT * FROM itinerary ORDER BY day ASC'
                        ).all();

                        const parsedResults = results.map(row => ({
                            ...row,
                            schedule: row.schedule ? JSON.parse(row.schedule) : [],
                            places: row.places ? JSON.parse(row.places) : [],
                        }));

                        return jsonResponse(parsedResults);
                    } catch (e) {
                        return jsonResponse({ error: '数据库查询失败: ' + e.message }, 500);
                    }
                }

                if (method === 'PUT') {
                    // ... 保持你原有的 PUT 逻辑不变 ...
                    return jsonResponse({ error: 'PUT 方法暂未实现' }, 501);
                }

                return jsonResponse({ error: 'Method not allowed' }, 405);
            }

            return jsonResponse({ error: 'API not found' }, 404);
        }

        // ============================================================
        // 2. 关键修复：通过 env.ASSETS 正确返回静态文件
        // ============================================================
        try {
            // 构建正确的文件路径，默认指向 index.html
            let filePath = path;
            if (filePath === '/' || filePath === '') {
                filePath = '/index.html';
            }

            // 从 Pages 的静态存储中获取文件
            const asset = await env.ASSETS.fetch(
                new Request(new URL(filePath, request.url).toString(), request)
            );

            // 如果文件存在，直接返回
            if (asset.status === 200) {
                return asset;
            }
        } catch (e) {
            // 忽略错误，继续执行 404
        }

        // ============================================================
        // 3. 404
        // ============================================================
        return new Response('Not Found', {
            status: 404,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }
};
