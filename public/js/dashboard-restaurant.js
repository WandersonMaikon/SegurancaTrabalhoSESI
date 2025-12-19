const charts = [];
function getOptionOrders(isDark) {
    const gridColor = isDark ? 'var(--color-zinc-700)' : 'var(--color-zinc-200)';
    const textColor = isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-500)';

    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: isDark ? 'var(--color-zinc-800)' : 'var(--color-white)',
            borderColor: gridColor,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor,
                fontWeight:400
            }
        },
        grid: {
            right: '40px',
            left: '0px',
            bottom: '30px',
            top: '40px'
        },
        legend: {
            show: true,
            top: 0,
            itemGap: 40,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor
            }
        },
        xAxis: {
            type: 'category',
            boundaryGap: true,
            data: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'],
            axisLine: { lineStyle: { color: gridColor, type: 'dashed' } },
            axisLabel: {
                align: 'left',
                fontSize: 'var(--text-sm)',
                padding: [0, 0, 0, -10],
                showMaxLabel: false,
                color: isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-400)',
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
                fontSize: 'var(--text-sm)',
                color: isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-400)'
            },
            splitLine: { lineStyle: { color: gridColor, type: 'dashed' } }
        },
        series: [
            
            {
                name: 'Orders',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                showSymbol: true,
                emphasis: {
                   disabled:true
                },
                lineStyle: { color: 'var(--color-primary)' },
                itemStyle: { color: 'var(--color-primary)' },
                data: [3, 7, 12, 16, 11, 18, 9, 14, 7, 24, 14, 6]
            },
             
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
initChart(document.getElementById('chart_orders'), getOptionOrders);