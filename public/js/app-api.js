

const charts = [];
function getOptionApi(isDark) {
    const gridColor = isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-200)';
    const textColor = isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-500)';
    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: isDark ? 'var(--color-zinc-800)' : 'var(--color-white)',
            borderColor: gridColor,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor
            },
            formatter: function (params) {
                const value = params[0].value;
                return `${params[0].axisValue}<br/><span>${value}</span>`;
            }
        },
        grid: {
            right: '40px',
            left: '10px',
            bottom: '30px',
            top: '3%'
        },
        legend: {
            show: false,
            bottom: 0,
            itemGap: 20,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor
            }
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: ['00:00', '01:15', '02:30', '03:45', '05:00', '06:15', '07:30', '08:45', '10:00', '11:15', '12:30', '13:45', '15:00', '16:15', '17:30', '18:45', '20:00', '21:15', '22:30', '23:45'],
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: {
                align: 'left',
                fontSize: 11,
                padding: [0, 0, 0, 5],
                showMaxLabel: false,
                color: textColor,
                fontFamily: 'inherit',
                
            }
        },
        yAxis: {
            position: 'right',
            axisTick: 'none',
            type: 'value',
            axisLine: { show: false, lineStyle: { color: gridColor } },
            axisLabel: {
                fontFamily: 'inherit',
                fontSize: 'var(--text-xs)',
                color: textColor,
                 formatter: value => value / 1000 + 'k'
            },
            splitLine: { lineStyle: { color: gridColor } }
        },
        series: [
            {
                type: 'line',
                data: [300, 580, 450, 660, 570, 730, 650, 800, 700, 860, 680, 890, 770, 1100, 800, 1250, 900, 1440, 1050, 1700],
                symbol: 'none',
                smooth: true,
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [{
                            offset: 0,
                            color: 'var(--color-primary-subtle)'
                        }, {
                            offset: 1,
                            color: 'rgba(0,0,0,0)'
                        }]
                    }
                },
                lineStyle: {
                    color: 'var(--color-primary)',
                    width: 2
                },
                emphasis: {
                    disabled: true
                },
            }
        ]
    };
}
function initChart(el, getOptionFn) {
    const chart = echarts.init(el, null, { renderer: 'svg' });
    charts.push({ chart, getOptionFn, el });

    chart.setOption(getOptionFn(isDarkMode()));
    // ResizeObserver
    if (window.ResizeObserver) {
        const resizeObserver = new ResizeObserver(() => chart.resize());
        resizeObserver.observe(el);
    }
}

function isDarkMode() {
    return document.documentElement.classList.contains('dark');
}

function rerenderAll() {
    const isDark = isDarkMode();
    charts.forEach(({ chart, getOptionFn }) => {
        chart.setOption(getOptionFn(isDark));
    });
}


// Rerender on theme change
const themeObserver = new MutationObserver(rerenderAll);
themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
});

// Rerender on window resize (fallback)
window.addEventListener('resize', () => {
    charts.forEach(({ chart }) => chart.resize());
});
// Initialize all charts
initChart(document.getElementById('chart_api'), getOptionApi);