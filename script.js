// ============================================================
// 重庆-丰都旅游攻略 - 完整主脚本（修复版）
// ============================================================

// ---- 配置 ----
const GITHUB_IMAGE_BASE = 'https://raw.githubusercontent.com/tuboshu5418/chongqing-travel-images/main';
const MAP_IMAGE_BASE = GITHUB_IMAGE_BASE + '/maps';

// 路线图圆点坐标（百分比）
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

// ---- 状态 ----
let allDaysData = [];
let currentTab = 1;
let isAdminMode = false;
let floatingCardPinned = false;
let floatingCardData = null;
let hoverTimeout = null;

// ---- DOM 引用 ----
const floatingCard = document.getElementById('floating-card');
const floatingCardClose = document.getElementById('floating-card-close');
const floatingCardImg = document.getElementById('floating-card-img');
const floatingCardName = document.getElementById('floating-card-name');
const floatingCardDesc = document.getElementById('floating-card-desc');
const floatingCardJump = document.getElementById('floating-card-jump');

// ============================================================
// 1. 数据加载
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
// 2. 路线总览
// ============================================================
function renderOverview() {
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
        html += `<div class="map-point" style="left:${p.x}%; top:${p.y}%;" data-day="${day}" data-place-index="${p.placeIndex}" 
                     onmouseenter="onMapPointHover(${day}, ${p.placeIndex}, this)" 
                     onmouseleave="onMapPointLeave()"
                     onclick="onMapPointClick(${day}, ${p.placeIndex}, this)">
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
// 3. 悬浮卡片（悬停延迟 + 点击固定）
// ============================================================
function getDayPlaceData(day, placeIndex) {
    const dayData = allDaysData.find(d => d.day === day);
    if (!dayData || !dayData.places || !dayData.places[placeIndex]) {
        return null;
    }
    return dayData.places[placeIndex];
}

function showFloatingCard(day, placeIndex, event, isPinned = false) {
    const place = getDayPlaceData(day, placeIndex);
    if (!place) return;

    // 清除之前的悬停定时器
    if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
    }

    floatingCardData = { day, placeIndex };

    floatingCardName.textContent = place.name;
    floatingCardDesc.textContent = place.desc || '暂无介绍';

    const imgName = getImageName(place.name);
    if (imgName) {
        floatingCardImg.src = GITHUB_IMAGE_BASE + '/' + imgName;
        floatingCardImg.style.display = 'block';
        floatingCardImg.onerror = () => { floatingCardImg.style.display = 'none'; };
    } else {
        floatingCardImg.style.display = 'none';
    }

    // 定位
    const rect = event.getBoundingClientRect();
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
    
    floatingCardPinned = isPinned;
    floatingCard.dataset.pinned = isPinned ? 'true' : 'false';

    requestAnimationFrame(() => {
        floatingCard.classList.add('show');
    });
}

function hideFloatingCard() {
    if (floatingCardPinned) return;
    if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
    }
    // 延迟关闭，防止误触
    hoverTimeout = setTimeout(() => {
        floatingCard.classList.remove('show');
        setTimeout(() => {
            if (!floatingCardPinned) {
                floatingCard.style.display = 'none';
            }
        }, 300);
        hoverTimeout = null;
    }, 200);
}

function onMapPointHover(day, placeIndex, element) {
    if (floatingCardPinned) return;
    // 清除之前的关闭定时器
    if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
    }
    showFloatingCard(day, placeIndex, element, false);
}

function onMapPointLeave() {
    if (floatingCardPinned) return;
    hideFloatingCard();
}

function onMapPointClick(day, placeIndex, element) {
    if (floatingCardPinned && floatingCardData && 
        floatingCardData.day === day && floatingCardData.placeIndex === placeIndex) {
        // 取消固定
        floatingCardPinned = false;
        floatingCard.dataset.pinned = 'false';
        hideFloatingCard();
        return;
    }
    // 清除悬停定时器
    if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
    }
    showFloatingCard(day, placeIndex, element, true);
}

floatingCardClose.onclick = function() {
    floatingCardPinned = false;
    floatingCard.dataset.pinned = 'false';
    hideFloatingCard();
};

document.addEventListener('click', function(e) {
    if (floatingCard.style.display === 'block' && !floatingCard.contains(e.target) && !e.target.closest('.map-point')) {
        if (!floatingCardPinned) {
            hideFloatingCard();
        }
    }
});

floatingCardJump.onclick = function() {
    if (!floatingCardData) return;
    const { day, placeIndex } = floatingCardData;
    
    floatingCardPinned = false;
    floatingCard.dataset.pinned = 'false';
    hideFloatingCard();

    const targetDay = document.getElementById('day-group-' + day);
    if (targetDay) {
        document.querySelectorAll('.day-group').forEach(g => {
            g.classList.add('open');
            const body = g.querySelector('.day-body');
            if (body) {
                body.style.maxHeight = body.scrollHeight + 'px';
                body.style.opacity = '1';
                body.style.padding = '6px 20px 24px';
            }
        });
        setTimeout(() => {
            targetDay.scrollIntoView({ behavior: 'smooth', block: 'start' });
            targetDay.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
            targetDay.style.boxShadow = '0 0 0 3px #a0524a, 0 4px 20px rgba(160,82,74,0.2)';
            targetDay.style.borderColor = '#a0524a';
            setTimeout(() => {
                targetDay.style.boxShadow = '';
                targetDay.style.borderColor = '';
            }, 3000);
        }, 300);
    }
};

// ============================================================
// 4. 图片名称映射
// ============================================================
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
    for (const [key, value] of Object.entries(map)) {
        if (name.includes(key) || key.includes(name)) {
            return value;
        }
    }
    return null;
}

// ============================================================
// 5. 渲染每日行程
// ============================================================
function renderDays(data) {
    const container = document.getElementById('day-groups-container');
    if (!container) return;

    let html = '';
    data.forEach((day, index) => {
        const isOpen = false;

        html += `<div class="day-group" id="day-group-${day.day}">`;
        html += `<div class="day-header" onclick="toggleDay(this)">
                    <span class="title">${day.title} <small>${day.subtitle || ''}</small></span>
                    <span class="arrow">▾</span>
                </div>`;
        html += `<div class="day-body">`;

        if (day.walk_badge) {
            html += `<div class="walk-badge">${day.walk_badge}</div>`;
        }

        if (day.breakfast || day.lunch || day.dinner) {
            html += `<div class="meal-bar">`;
            if (day.breakfast) html += `<span>🌅 早餐：${day.breakfast}</span>`;
            if (day.lunch) html += `<span>☀️ 午餐：${day.lunch}</span>`;
            if (day.dinner) html += `<span>🌙 晚餐：${day.dinner}</span>`;
            html += `</div>`;
        }

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

        if (day.places && day.places.length > 0) {
            day.places.forEach((place, idx) => {
                const imgName = getImageName(place.name);
                const imgUrl = imgName ? GITHUB_IMAGE_BASE + '/' + imgName : '';
                const emoji = getEmoji(place.name);

                html += `<div class="place-card" data-day="${day.day}" data-place-index="${idx}">`;
                html += `<div class="place-name">${place.name} <span class="tag">${place.tag || ''}</span></div>`;
                html += `<div class="place-image">`;
                if (imgUrl) {
                    html += `<img src="${imgUrl}" alt="${place.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />`;
                    html += `<div class="placeholder-text" style="display:none;"><span>${emoji}</span>${place.name}</div>`;
                } else {
                    html += `<div class="placeholder-text"><span>${emoji}</span>${place.name}</div>`;
                }
                html += `</div>`;
                html += `<div class="place-desc">${place.desc || ''}</div>`;
                if (place.meta) {
                    html += `<div class="meta">${place.meta}</div>`;
                }
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
    
    // 初始化折叠状态
    document.querySelectorAll('.day-group .day-body').forEach(body => {
        body.style.maxHeight = '0';
        body.style.opacity = '0';
        body.style.padding = '0 20px';
    });

    // 绑定点击波纹事件
    document.querySelectorAll('.place-card, .btn').forEach(el => {
        el.addEventListener('click', function(e) {
            createRipple(e, this);
        });
    });
}

// ============================================================
// 6. 物理光效 - 点击波纹
// ============================================================
function createRipple(event, element) {
    const rect = element.getBoundingClientRect();
    const x = (event.clientX || event.pageX) - rect.left;
    const y = (event.clientY || event.pageY) - rect.top;
    
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const size = Math.max(rect.width, rect.height) * 0.8;
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (x - size/2) + 'px';
    ripple.style.top = (y - size/2) + 'px';
    
    element.appendChild(ripple);
    setTimeout(() => {
        ripple.remove();
    }, 800);
}

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
// 7. 折叠切换（带动画）
// ============================================================
window.toggleDay = function(header) {
    const group = header.closest('.day-group');
    if (!group) return;
    const body = group.querySelector('.day-body');
    if (!body) return;

    const isOpen = group.classList.contains('open');
    if (isOpen) {
        // 关闭
        body.style.maxHeight = body.scrollHeight + 'px';
        requestAnimationFrame(() => {
            body.style.maxHeight = '0';
            body.style.opacity = '0';
            body.style.padding = '0 20px';
        });
        group.classList.remove('open');
        header.classList.remove('sticky');
    } else {
        // 展开
        group.classList.add('open');
        body.style.maxHeight = '0';
        body.style.opacity = '0';
        body.style.padding = '0 20px';
        requestAnimationFrame(() => {
            body.style.maxHeight = body.scrollHeight + 'px';
            body.style.opacity = '1';
            body.style.padding = '6px 20px 24px';
        });
        // 检测是否需要 sticky
        setTimeout(() => checkSticky(), 100);
    }
};

// ============================================================
// 8. Day 栏目滚动置顶（Sticky 吸附）
// ============================================================
function checkSticky() {
    document.querySelectorAll('.day-group .day-header').forEach(header => {
        const rect = header.getBoundingClientRect();
        const containerRect = header.closest('.app-container').getBoundingClientRect();
        // 如果 header 到达顶部，添加 sticky 类
        if (rect.top <= 4) {
            header.classList.add('sticky');
        } else {
            header.classList.remove('sticky');
        }
    });
}

function setupStickyDays() {
    // 滚动时检测 sticky 状态
    window.addEventListener('scroll', checkSticky, { passive: true });
    window.addEventListener('resize', checkSticky, { passive: true });
    // 初始检测
    setTimeout(checkSticky, 500);
}

// ============================================================
// 9. 一键展开/收缩
// ============================================================
function setupExpandCollapse() {
    const expandBtn = document.getElementById('admin-expand-all-btn');
    const collapseBtn = document.getElementById('admin-collapse-all-btn');

    if (expandBtn) {
        expandBtn.onclick = function() {
            document.querySelectorAll('.day-group').forEach(group => {
                const body = group.querySelector('.day-body');
                if (body && !group.classList.contains('open')) {
                    group.classList.add('open');
                    body.style.maxHeight = '0';
                    body.style.opacity = '0';
                    body.style.padding = '0 20px';
                    requestAnimationFrame(() => {
                        body.style.maxHeight = body.scrollHeight + 'px';
                        body.style.opacity = '1';
                        body.style.padding = '6px 20px 24px';
                    });
                }
            });
            setTimeout(checkSticky, 300);
        };
    }

    if (collapseBtn) {
        collapseBtn.onclick = function() {
            document.querySelectorAll('.day-group').forEach(group => {
                const body = group.querySelector('.day-body');
                const header = group.querySelector('.day-header');
                if (body && group.classList.contains('open')) {
                    body.style.maxHeight = body.scrollHeight + 'px';
                    requestAnimationFrame(() => {
                        body.style.maxHeight = '0';
                        body.style.opacity = '0';
                        body.style.padding = '0 20px';
                    });
                    group.classList.remove('open');
                    if (header) header.classList.remove('sticky');
                }
            });
        };
    }
}

// ============================================================
// 10. 修改模式（密码验证）
// ============================================================
function setupAdminMode() {
    const toggleBtn = document.getElementById('admin-toggle-btn');
    const loginArea = document.getElementById('admin-login-area');
    const editArea = document.getElementById('admin-edit-area');
    const passwordInput = document.getElementById('admin-password-input');
    const loginBtn = document.getElementById('admin-login-btn');
    const statusSpan = document.getElementById('admin-login-status');

    if (!toggleBtn) return;

    toggleBtn.onclick = function() {
        if (isAdminMode) {
            isAdminMode = false;
            loginArea.style.display = 'none';
            editArea.style.display = 'none';
            statusSpan.textContent = '';
            toggleBtn.textContent = '🔧 修改模式';
            toggleBtn.style.borderColor = '#c0b0a8';
            document.querySelectorAll('.place-card').forEach(card => {
                card.style.outline = 'none';
                card.style.cursor = 'default';
                card.onclick = null;
                card.classList.remove('clickable');
            });
            document.querySelectorAll('.schedule-table tbody tr').forEach(row => {
                row.style.cursor = 'default';
                row.title = '';
                row.onclick = null;
            });
        } else {
            loginArea.style.display = 'flex';
            toggleBtn.textContent = '🔧 退出修改';
            toggleBtn.style.borderColor = '#a0524a';
            passwordInput.value = '';
            passwordInput.focus();
            statusSpan.textContent = '';
        }
    };

    loginBtn.onclick = async function() {
        const password = passwordInput.value.trim();
        if (!password) {
            statusSpan.textContent = '请输入密码';
            return;
        }

        try {
            const response = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const result = await response.json();

            if (result.success) {
                isAdminMode = true;
                statusSpan.textContent = '✅ 验证成功！';
                editArea.style.display = 'flex';
                loginArea.style.display = 'none';
                toggleBtn.textContent = '🔧 退出修改';
                enableEditing();
            } else {
                statusSpan.textContent = '❌ ' + (result.error || '密码错误');
            }
        } catch (e) {
            statusSpan.textContent = '❌ 网络错误';
        }
    };

    passwordInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            loginBtn.click();
        }
    });
}

// ============================================================
// 11. 编辑功能
// ============================================================
function enableEditing() {
    document.querySelectorAll('.place-card').forEach(card => {
        card.style.outline = '2px dashed #a0524a';
        card.style.outlineOffset = '2px';
        card.style.cursor = 'pointer';
        card.title = '点击编辑此景点';
        card.classList.add('clickable');

        card.onclick = function(e) {
            if (e.target.closest('.btn')) return;
            if (e.target.closest('.place-image')) return;
            const day = parseInt(this.dataset.day);
            const placeIndex = parseInt(this.dataset.placeIndex);
            openEditModal(day, placeIndex);
        };
    });

    document.querySelectorAll('.schedule-table tbody tr').forEach(row => {
        row.style.cursor = 'pointer';
        row.title = '点击编辑此时间项';
        row.onclick = function() {
            const dayGroup = this.closest('.day-group');
            if (!dayGroup) return;
            const day = parseInt(dayGroup.id.replace('day-group-', ''));
            const dayData = allDaysData.find(d => d.day === day);
            if (!dayData || !dayData.schedule) return;
            const rows = Array.from(this.closest('tbody').querySelectorAll('tr'));
            const index = rows.indexOf(this);
            if (index >= 0 && index < dayData.schedule.length) {
                openEditScheduleModal(day, index);
            }
        };
    });
}

// ---- 编辑景点弹窗 ----
function openEditModal(day, placeIndex) {
    const dayData = allDaysData.find(d => d.day === day);
    if (!dayData || !dayData.places || !dayData.places[placeIndex]) return;

    const place = dayData.places[placeIndex];
    const modal = document.createElement('div');
    modal.id = 'edit-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.4);
        backdrop-filter: blur(4px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    `;
    modal.innerHTML = `
        <div style="background:#fff; border-radius:20px; padding:30px; max-width:600px; width:90%; max-height:80vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <h3 style="margin-bottom:16px; color:#4a4a4a;">编辑景点: ${place.name}</h3>
            <div style="margin-bottom:12px;">
                <label style="display:block; font-size:14px; color:#6a6a6a; margin-bottom:4px;">景点名称</label>
                <input id="edit-place-name" value="${place.name}" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid #ddd9d2; font-size:15px;">
            </div>
            <div style="margin-bottom:12px;">
                <label style="display:block; font-size:14px; color:#6a6a6a; margin-bottom:4px;">标签</label>
                <input id="edit-place-tag" value="${place.tag || ''}" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid #ddd9d2; font-size:15px;">
            </div>
            <div style="margin-bottom:12px;">
                <label style="display:block; font-size:14px; color:#6a6a6a; margin-bottom:4px;">介绍</label>
                <textarea id="edit-place-desc" rows="3" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid #ddd9d2; font-size:15px; resize:vertical;">${place.desc || ''}</textarea>
            </div>
            <div style="margin-bottom:12px;">
                <label style="display:block; font-size:14px; color:#6a6a6a; margin-bottom:4px;">元信息 (如: 🎫 免费 · 全天开放)</label>
                <input id="edit-place-meta" value="${place.meta || ''}" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid #ddd9d2; font-size:15px;">
            </div>
            <div style="display:flex; gap:10px; margin-top:16px;">
                <button id="edit-place-save" style="padding:10px 28px; border-radius:30px; border:none; background:#4a6a7f; color:#fff; cursor:pointer; font-size:15px;">💾 保存</button>
                <button id="edit-place-close" style="padding:10px 28px; border-radius:30px; border:1px solid #ddd9d2; background:#f5f3f0; cursor:pointer; font-size:15px;">取消</button>
                <button id="edit-place-delete" style="padding:10px 28px; border-radius:30px; border:none; background:#a0524a; color:#fff; cursor:pointer; font-size:15px; margin-left:auto;">🗑️ 删除</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#edit-place-close').onclick = () => modal.remove();
    modal.querySelector('#edit-place-save').onclick = async function() {
        const newName = document.getElementById('edit-place-name').value.trim();
        const newTag = document.getElementById('edit-place-tag').value.trim();
        const newDesc = document.getElementById('edit-place-desc').value.trim();
        const newMeta = document.getElementById('edit-place-meta').value.trim();

        if (!newName) { alert('景点名称不能为空'); return; }

        const password = document.getElementById('admin-password-input').value.trim();
        if (!password) { alert('请输入管理员密码'); return; }

        const places = [...dayData.places];
        places[placeIndex] = {
            ...places[placeIndex],
            name: newName,
            tag: newTag,
            desc: newDesc,
            meta: newMeta
        };

        try {
            const response = await fetch('/api/itinerary/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password,
                    day: day,
                    places: places
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('✅ 保存成功！');
                modal.remove();
                location.reload();
            } else {
                alert('❌ 保存失败: ' + (result.error || '未知错误'));
            }
        } catch (e) {
            alert('❌ 网络错误: ' + e.message);
        }
    };

    modal.querySelector('#edit-place-delete').onclick = async function() {
        if (!confirm(`确定要删除景点 "${place.name}" 吗？`)) return;
        const password = document.getElementById('admin-password-input').value.trim();
        if (!password) { alert('请输入管理员密码'); return; }

        const places = dayData.places.filter((_, i) => i !== placeIndex);
        try {
            const response = await fetch('/api/itinerary/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password,
                    day: day,
                    places: places
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('✅ 已删除！');
                modal.remove();
                location.reload();
            } else {
                alert('❌ 删除失败: ' + (result.error || '未知错误'));
            }
        } catch (e) {
            alert('❌ 网络错误: ' + e.message);
        }
    };
}

// ---- 编辑时间项弹窗 ----
function openEditScheduleModal(day, index) {
    const dayData = allDaysData.find(d => d.day === day);
    if (!dayData || !dayData.schedule || !dayData.schedule[index]) return;

    const item = dayData.schedule[index];
    const modal = document.createElement('div');
    modal.id = 'edit-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.4);
        backdrop-filter: blur(4px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    `;
    modal.innerHTML = `
        <div style="background:#fff; border-radius:20px; padding:30px; max-width:500px; width:90%; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <h3 style="margin-bottom:16px; color:#4a4a4a;">编辑时间项</h3>
            <div style="margin-bottom:12px;">
                <label style="display:block; font-size:14px; color:#6a6a6a; margin-bottom:4px;">时间 (如: 10:00-11:30)</label>
                <input id="edit-schedule-time" value="${item.time || ''}" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid #ddd9d2; font-size:15px;">
            </div>
            <div style="margin-bottom:12px;">
                <label style="display:block; font-size:14px; color:#6a6a6a; margin-bottom:4px;">活动描述</label>
                <input id="edit-schedule-activity" value="${item.activity || ''}" style="width:100%; padding:8px 12px; border-radius:10px; border:1px solid #ddd9d2; font-size:15px;">
            </div>
            <div style="display:flex; gap:10px; margin-top:16px;">
                <button id="edit-schedule-save" style="padding:10px 28px; border-radius:30px; border:none; background:#4a6a7f; color:#fff; cursor:pointer; font-size:15px;">💾 保存</button>
                <button id="edit-schedule-close" style="padding:10px 28px; border-radius:30px; border:1px solid #ddd9d2; background:#f5f3f0; cursor:pointer; font-size:15px;">取消</button>
                <button id="edit-schedule-delete" style="padding:10px 28px; border-radius:30px; border:none; background:#a0524a; color:#fff; cursor:pointer; font-size:15px; margin-left:auto;">🗑️ 删除</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#edit-schedule-close').onclick = () => modal.remove();
    modal.querySelector('#edit-schedule-save').onclick = async function() {
        const time = document.getElementById('edit-schedule-time').value.trim();
        const activity = document.getElementById('edit-schedule-activity').value.trim();
        if (!time || !activity) { alert('时间和活动不能为空'); return; }

        const password = document.getElementById('admin-password-input').value.trim();
        if (!password) { alert('请输入管理员密码'); return; }

        const schedule = [...dayData.schedule];
        schedule[index] = { time, activity };

        try {
            const response = await fetch('/api/itinerary/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password,
                    day: day,
                    schedule: schedule
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('✅ 保存成功！');
                modal.remove();
                location.reload();
            } else {
                alert('❌ 保存失败: ' + (result.error || '未知错误'));
            }
        } catch (e) {
            alert('❌ 网络错误: ' + e.message);
        }
    };

    modal.querySelector('#edit-schedule-delete').onclick = async function() {
        if (!confirm('确定要删除此时间项吗？')) return;
        const password = document.getElementById('admin-password-input').value.trim();
        if (!password) { alert('请输入管理员密码'); return; }

        const schedule = dayData.schedule.filter((_, i) => i !== index);
        try {
            const response = await fetch('/api/itinerary/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password,
                    day: day,
                    schedule: schedule
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('✅ 已删除！');
                modal.remove();
                location.reload();
            } else {
                alert('❌ 删除失败: ' + (result.error || '未知错误'));
            }
        } catch (e) {
            alert('❌ 网络错误: ' + e.message);
        }
    };
}

// ============================================================
// 12. 滚动动画
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
// 13. 阅读进度条 & 返回顶部
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
// 14. 页面加载
// ============================================================
document.addEventListener('DOMContentLoaded', async function() {
    const data = await loadItineraryData();
    if (data && data.length > 0) {
        allDaysData = data;
        renderDays(data);
        renderOverview();
        setupStickyDays();
        setupExpandCollapse();
        setupAdminMode();
        setupScrollAnimation();
        setupBackToTop();
        window.addEventListener('scroll', updateReadingProgress, { passive: true });
        updateReadingProgress();

        // 初始化折叠状态
        document.querySelectorAll('.day-group .day-body').forEach(body => {
            body.style.maxHeight = '0';
            body.style.opacity = '0';
            body.style.padding = '0 20px';
        });
    } else {
        document.getElementById('day-groups-container').innerHTML = '<p style="padding:40px;text-align:center;color:#8a8a8a;">⚠️ 无法加载行程数据，请检查网络连接或API配置。</p>';
    }
});

// 暴露全局函数
window.toggleDay = window.toggleDay;
window.toggleOverview = function(header) {
    const group = header.closest('.overview-group');
    if (group) group.classList.toggle('open');
};
window.onMapPointHover = onMapPointHover;
window.onMapPointLeave = onMapPointLeave;
window.onMapPointClick = onMapPointClick;
