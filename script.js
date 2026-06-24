// ============================================================
// 配置
// ============================================================
const GITHUB_IMAGE_BASE = 'https://raw.githubusercontent.com/tuboshu5418/chongqing-travel-images/main';
const MAP_IMAGE_BASE = GITHUB_IMAGE_BASE + '/maps';

// 6天路线图的景点圆点坐标（百分比，相对于图片宽高）
// 需要根据你实际截图的比例调整这些值
const DAY_POINTS = {
    1: [
        { id: 'day1_1', name: '江北机场', x: 8, y: 15, placeIndex: 0 },
        { id: 'day1_2', name: '解放碑', x: 30, y: 55, placeIndex: 1 },
        { id: 'day1_3', name: '八一好吃街', x: 35, y: 60, placeIndex: 2 },
        { id: 'day1_4', name: '白象居', x: 45, y: 65, placeIndex: 3 },
        { id: 'day1_5', name: '长江索道', x: 50, y: 70, placeIndex: 4 },
        { id: 'day1_6', name: 'WFC会仙楼', x: 38, y: 50, placeIndex: 5 },
        { id: 'day1_7', name: '洪崖洞', x: 42, y: 48, placeIndex: 6 }
    ],
    2: [
        { id: 'day2_1', name: '李子坝', x: 20, y: 40, placeIndex: 0 },
        { id: 'day2_2', name: '鹅岭二厂', x: 25, y: 35, placeIndex: 1 },
        { id: 'day2_3', name: '山城步道', x: 40, y: 50, placeIndex: 2 },
        { id: 'day2_4', name: '十八梯', x: 45, y: 55, placeIndex: 3 },
        { id: 'day2_5', name: '观音桥', x: 30, y: 20, placeIndex: 4 }
    ],
    3: [
        { id: 'day3_1', name: '重庆动物园', x: 15, y: 60, placeIndex: 0 },
        { id: 'day3_2', name: '三峡博物馆', x: 40, y: 45, placeIndex: 1 },
        { id: 'day3_3', name: '观音桥', x: 45, y: 25, placeIndex: 2 }
    ],
    4: [
        { id: 'day4_1', name: '弹子石老街', x: 55, y: 65, placeIndex: 0 },
        { id: 'day4_2', name: '盘龙立交', x: 60, y: 50, placeIndex: 1 },
        { id: 'day4_3', name: '龙门浩老街', x: 50, y: 70, placeIndex: 2 },
        { id: 'day4_4', name: '来福士云端乐园', x: 40, y: 55, placeIndex: 3 }
    ],
    5: [
        { id: 'day5_1', name: '重庆北站', x: 15, y: 20, placeIndex: 0 },
        { id: 'day5_2', name: '丰都站', x: 70, y: 50, placeIndex: 1 },
        { id: 'day5_3', name: '丰都鬼城', x: 80, y: 60, placeIndex: 2 }
    ],
    6: [
        { id: 'day6_1', name: '丰都县城', x: 20, y: 40, placeIndex: 0 },
        { id: 'day6_2', name: '双桂山', x: 35, y: 55, placeIndex: 1 },
        { id: 'day6_3', name: '丰都码头', x: 60, y: 70, placeIndex: 2 }
    ]
};

// ============================================================
// 状态
// ============================================================
let allDaysData = [];
let currentTab = 1;

// ============================================================
// DOM 引用
// ============================================================
const floatingCard = document.getElementById('floating-card');
const floatingCardClose = document.getElementById('floating-card-close');
const floatingCardImg = document.getElementById('floating-card-img');
const floatingCardName = document.getElementById('floating-card-name');
const floatingCardDesc = document.getElementById('floating-card-desc');
const floatingCardJump = document.getElementById('floating-card-jump');

// ============================================================
// 1. 从 API 加载行程数据
// ============================================================
async function loadItineraryData() {
    try {
        const response = await fetch('/api/itinerary');
        if (!response.ok) throw new Error('API error');
        const data = await response.json();
        allDaysData = data;
        return data;
    } catch (error) {
        console.error('加载行程数据失败:', error);
        return null;
    }
}

// ============================================================
// 2. 渲染路线总览
// ============================================================
function renderOverview() {
    // 生成标签
    const tabBar = document.getElementById('tab-bar');
    tabBar.innerHTML = '';
    for (let i = 1; i <= 6; i++) {
        const btn = document.createElement('button');
        btn.className = 'tab-btn' + (i === currentTab ? ' active' : '');
        btn.dataset.day = i;
        btn.textContent = 'Day ' + i;
        btn.onclick = () => switchTab(i);
        tabBar.appendChild(btn);
    }

    // 渲染当前标签的地图
    renderMap(currentTab);
}

function renderMap(day) {
    const container = document.getElementById('overview-maps');
    const points = DAY_POINTS[day] || [];
    const imgUrl = MAP_IMAGE_BASE + '/day' + day + '_overview.png';

    let html = `<div class="map-wrapper" id="map-wrapper-${day}">`;
    html += `<img src="${imgUrl}" alt="Day ${day} 路线图" onerror="this.style.display='none'; document.getElementById('map-error-${day}').style.display='flex';" />`;
    html += `<div id="map-error-${day}" style="display:none; height:300px; align-items:center; justify-content:center; color:#8a8a8a; background:#f6f4f1; border-radius:14px; flex-direction:column; gap:8px;">
                <span>🖼️ 图片加载失败</span>
                <span style="font-size:13px;">请确认 maps/day${day}_overview.png 已上传</span>
             </div>`;

    points.forEach(p => {
        html += `<div class="map-point" style="left:${p.x}%; top:${p.y}%;" data-day="${day}" data-place-index="${p.placeIndex}" onclick="showFloatingCard(${day}, ${p.placeIndex}, event)">
                    ${p.placeIndex + 1}
                </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

function switchTab(day) {
    currentTab = day;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.day) === day);
    });
    renderMap(day);
}

// ============================================================
// 3. 悬浮卡片
// ============================================================
function showFloatingCard(day, placeIndex, event) {
    const dayData = allDaysData.find(d => d.day === day);
    if (!dayData || !dayData.places || !dayData.places[placeIndex]) {
        return;
    }

    const place = dayData.places[placeIndex];
    const rect = event.target.getBoundingClientRect();

    // 设置卡片内容
    floatingCardName.textContent = place.name;
    floatingCardDesc.textContent = place.desc || '暂无介绍';

    // 图片
    const imgName = getImageName(place.name);
    if (imgName) {
        floatingCardImg.src = GITHUB_IMAGE_BASE + '/' + imgName;
        floatingCardImg.style.display = 'block';
        floatingCardImg.onerror = () => {
            floatingCardImg.style.display = 'none';
        };
    } else {
        floatingCardImg.style.display = 'none';
    }

    // 存储跳转信息
    floatingCard.dataset.day = day;
    floatingCard.dataset.placeIndex = placeIndex;

    // 定位
    let left = rect.left + rect.width / 2 - 140;
    let top = rect.bottom + 12;
    if (left < 10) left = 10;
    if (left + 280 > window.innerWidth - 10) left = window.innerWidth - 290;
    if (top + 300 > window.innerHeight - 10) {
        top = rect.top - 300 - 12;
    }

    floatingCard.style.left = left + 'px';
    floatingCard.style.top = top + 'px';
    floatingCard.style.display = 'block';
    requestAnimationFrame(() => {
        floatingCard.classList.add('show');
    });
}

function hideFloatingCard() {
    floatingCard.classList.remove('show');
    setTimeout(() => {
        floatingCard.style.display = 'none';
    }, 300);
}

// 跳转至行程
floatingCardJump.onclick = function() {
    const day = parseInt(floatingCard.dataset.day);
    const placeIndex = parseInt(floatingCard.dataset.placeIndex);
    hideFloatingCard();

    // 展开所有天
    document.querySelectorAll('.day-group').forEach(g => g.classList.add('open'));

    // 滚动到对应景点卡片
    setTimeout(() => {
        const cards = document.querySelectorAll('.place-card');
        let target = null;
        let count = 0;
        for (let i = 0; i < cards.length; i++) {
            const d = parseInt(cards[i].dataset.day);
            if (d === day) {
                if (count === placeIndex) {
                    target = cards[i];
                    break;
                }
                count++;
            }
        }
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.style.boxShadow = '0 0 0 3px #a0524a';
            setTimeout(() => { target.style.boxShadow = ''; }, 2000);
        }
    }, 300);
};

floatingCardClose.onclick = hideFloatingCard;
document.addEventListener('click', function(e) {
    if (floatingCard.style.display === 'block' && !floatingCard.contains(e.target) && !e.target.closest('.map-point')) {
        hideFloatingCard();
    }
});

// 辅助：根据景点名称获取图片文件名
function getImageName(name) {
    const map = {
        '解放碑': 'jiefangbei.jpg',
        '八一好吃街': 'bayihaochijie.jpg',
        '白象居': 'baixiangju.jpg',
        '长江索道': 'changjiangsuodao.jpg',
        '洪崖洞': 'hongyadong.jpg',
        '李子坝': 'liziba.jpg',
        '鹅岭二厂': 'erling.jpg',
        '山城步道': 'shancheng.jpg',
        '南滨路': 'nanbinlu.jpg',
        '重庆动物园': 'panda.jpg',
        '三峡博物馆': 'sanxia.jpg',
        '观音桥': 'guanyinqiao.jpg',
        '弹子石老街': 'danzishi.jpg',
        '龙门浩老街': 'longmenhao.jpg',
        'WFC会仙楼': 'wfc.jpg',
        '十八梯': 'shibati.jpg',
        '盘龙立交': 'panlong.jpg',
        '来福士云端乐园': 'laifushi.jpg',
        '双桂山': 'shuanggui.jpg',
        '丰都鬼城': 'fengduguicheng.jpg',
        '丰都码头': 'fengdumatou.jpg'
    };
    // 模糊匹配
    for (const [key, value] of Object.entries(map)) {
        if (name.includes(key) || key.includes(name)) {
            return value;
        }
    }
    return null;
}

// ============================================================
// 4. 渲染每日行程
// ============================================================
function renderDays(data) {
    const container = document.getElementById('day-groups-container');
    if (!container) return;

    let html = '';
    data.forEach((day, index) => {
        const isOpen = false; // 默认全部折叠

        html += `<div class="day-group ${isOpen ? 'open' : ''}" id="day-group-${day.day}">`;
        html += `<div class="day-header" onclick="toggleDay(this)">
                    <span class="title">${day.title} <small>${day.subtitle || ''}</small></span>
                    <span class="arrow">▾</span>
                </div>`;
        html += `<div class="day-body">`;

        // 步行难度
        if (day.walk_badge) {
            html += `<div class="walk-badge">${day.walk_badge}</div>`;
        }

        // 三餐
        if (day.breakfast || day.lunch || day.dinner) {
            html += `<div class="meal-bar">`;
            if (day.breakfast) html += `<span>🌅 早餐：${day.breakfast}</span>`;
            if (day.lunch) html += `<span>☀️ 午餐：${day.lunch}</span>`;
            if (day.dinner) html += `<span>🌙 晚餐：${day.dinner}</span>`;
            html += `</div>`;
        }

        // 时间表
        if (day.schedule && day.schedule.length > 0) {
            html += `<table class="schedule-table">
                        <thead><tr><th>时间</th><th>安排</th></tr></thead>
                        <tbody>`;
            day.schedule.forEach(item => {
                const isLunch = item.activity && (item.activity.includes('🥘') || item.activity.includes('午餐'));
                html += `<tr>
                            <td class="time-col">${item.time || ''}</td>
                            <td class="${isLunch ? 'lunch-col' : ''}">${item.activity || ''}</td>
                        </tr>`;
            });
            html += `</tbody></table>`;
        }

        // 景点卡片
        if (day.places && day.places.length > 0) {
            day.places.forEach((place, idx) => {
                const imgName = getImageName(place.name);
                const imgUrl = imgName ? GITHUB_IMAGE_BASE + '/' + imgName : '';

                html += `<div class="place-card" data-day="${day.day}" data-place-index="${idx}">`;
                html += `<div class="place-name">${place.name} <span class="tag">${place.tag || ''}</span></div>`;

                // 图片
                html += `<div class="place-image">`;
                if (imgUrl) {
                    html += `<img src="${imgUrl}" alt="${place.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />`;
                    html += `<div class="placeholder-text" style="display:none;"><span>${getEmoji(place.name)}</span>${place.name}</div>`;
                } else {
                    html += `<div class="placeholder-text"><span>${getEmoji(place.name)}</span>${place.name}</div>`;
                }
                html += `</div>`;

                html += `<div class="place-desc">${place.desc || ''}</div>`;
                if (place.meta) {
                    html += `<div class="meta">${place.meta}</div>`;
                }

                // 按钮组
                html += `<div class="btn-group">`;
                if (place.navLink) {
                    html += `<a class="btn btn-nav" href="${place.navLink}" target="_blank">🧭 导航</a>`;
                }
                const links = place.platformLinks || {};
                if (links.dianping) {
                    html += `<a class="btn btn-dp" href="${links.dianping}" target="_blank">📝 大众点评</a>`;
                }
                if (links.meituan) {
                    html += `<a class="btn btn-mt" href="${links.meituan}" target="_blank">🍜 美团</a>`;
                }
                if (links.douyin) {
                    html += `<a class="btn btn-dy" href="${links.douyin}" target="_blank">🎵 抖音</a>`;
                }
                html += `</div>`;

                html += `</div>`;
            });
        }

        if (day.rest_note) {
            html += `<div class="rest-note">${day.rest_note}</div>`;
        }

        html += `</div>`;
        html += `</div>`;
    });

    container.innerHTML = html;
}

// 辅助：获取景点Emoji
function getEmoji(name) {
    const map = {
        '机场': '✈️',
        '解放碑': '🏛️',
        '好吃街': '🍜',
        '白象居': '🏚️',
        '索道': '🚠',
        '洪崖洞': '🏮',
        '李子坝': '🚇',
        '鹅岭': '🎨',
        '山城步道': '🚶',
        '南滨路': '🌉',
        '动物园': '🐼',
        '博物馆': '🏺',
        '观音桥': '🛍️',
        '弹子石': '🏘️',
        '龙门浩': '🏡',
        'WFC': '🌆',
        '十八梯': '🪜',
        '盘龙': '🛣️',
        '来福士': '🏗️',
        '双桂山': '🌳',
        '鬼城': '👻',
        '码头': '⚓'
    };
    for (const [key, value] of Object.entries(map)) {
        if (name.includes(key)) return value;
    }
    return '📍';
}

// ============================================================
// 5. 折叠切换
// ============================================================
window.toggleOverview = function(header) {
    const group = header.closest('.overview-group');
    if (group) group.classList.toggle('open');
};

window.toggleDay = function(header) {
    const group = header.closest('.day-group');
    if (group) group.classList.toggle('open');
};

// ============================================================
// 6. 滚动动画（Intersection Observer）
// ============================================================
function setupScrollAnimation() {
    const cards = document.querySelectorAll('.place-card');
    if (cards.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.15 });
    cards.forEach(card => observer.observe(card));
}

// ============================================================
// 7. 阅读进度条 & 返回顶部
// ============================================================
function updateReadingProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    const bar = document.getElementById('reading-progress-bar');
    if (bar) bar.style.width = Math.min(progress, 100) + '%';
}

function setupBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    const toggle = () => btn.classList.toggle('show', window.scrollY > 500);
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
}

// ============================================================
// 8. 启动
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
    const data = await loadItineraryData();
    if (data && data.length > 0) {
        allDaysData = data;
        renderDays(data);
        renderOverview();
        setupScrollAnimation();
        setupBackToTop();
        window.addEventListener('scroll', updateReadingProgress, { passive: true });
        updateReadingProgress();
    } else {
        document.getElementById('day-groups-container').innerHTML = '<p style="padding:40px;text-align:center;color:#8a8a8a;">⚠️ 无法加载行程数据，请检查网络连接或API配置。</p>';
    }
});
