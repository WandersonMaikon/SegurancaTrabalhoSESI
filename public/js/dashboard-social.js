const charts = [];
function getOptionLine(isDark) {
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
                color: textColor,fontWeight:400,
            }
        },
        grid: {
            right: '40px',
            left: '20px',
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
            data: ['Sep 1', 'Sep 2', 'Sep 3', 'Sep 4', 'Sep 5', 'Sep 6', 'Sep 7', 'Sep 8', 'Sep 9', 'Sep 10', 'Sep 11', 'Sep 12'],
            axisLine: { lineStyle: { color: gridColor,type: 'dashed' } },
            axisLabel: {
                align: 'left',
                fontSize: 11,
                
                showMaxLabel: false,
                color: isDark ? 'var(--color-zinc-500)' : 'var(--color-zinc-400)',
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
                color: isDark ? 'var(--color-zinc-500)' : 'var(--color-zinc-400)',
                formatter: value => value / 1000 + 'k'
            },
            splitLine: { 
                lineStyle: 
                { 
                    color: gridColor,
                    type: 'dashed'
                 } 
                }
        },
        series: [
            {
                name: 'Followers',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 7,
                showSymbol: false,
                emphasis: {
                  disabled:true
                },
                lineStyle: { color: 'var(--color-primary)' },
                itemStyle: { color: 'var(--color-primary)' },
                data: [87000, 57000, 74000, 98000, 74000, 44000, 62000, 49000, 82000, 56000, 47000, 54000]
            },
            {
                name: 'Non-followers',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 7,
                showSymbol: false,
                emphasis: {
                     disabled:true
                },
                lineStyle: { color: 'var(--color-pink-500)', type:'dashed' },
                itemStyle: { color: 'var(--color-pink-500)' },
                data: [35000, 41000, 62000, 42000, 14000, 18000, 29000, 37000, 36000, 5100, 32000, 34000]
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
initChart(document.getElementById('chart_social_views'), getOptionLine);
