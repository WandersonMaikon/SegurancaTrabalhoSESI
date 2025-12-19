const charts = [];

function getOptionJobs(isDark) {
    const gridColor = isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-200)';
    const textColor = isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-600)';

    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: isDark ? 'var(--color-zinc-800)' : 'var(--color-white)',
            borderColor: gridColor,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor,fontWeight:400
            },
        },
        grid: {
            left: '0px',
            right: '40px',
            bottom: '60px',
            top: '3%'
        },
        legend: {
            bottom: 0,
            itemGap: 30,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor
            }
        },
        xAxis: {
            type: 'category',
            data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            axisLine: { lineStyle: { color: gridColor, type: 'dashed' } },
            axisLabel: {
                fontSize: 11,
                fontFamily: 'inherit',
                color: isDark ? 'var(--color-zinc-500)' : 'var(--color-zinc-400)',
                padding: [0, 0, 0, 0]
            }
        },
        yAxis: {
            type: 'value',
            position: 'right',
            axisLine: { show: false },
            axisLabel: {
                fontFamily: 'inherit',
                fontSize: 'var(--text-xs)',
                color: isDark ? 'var(--color-zinc-500)' : 'var(--color-zinc-400)',
            },
            splitLine: { lineStyle: { color: gridColor, type: 'dashed' } }
        },
        series: [
            {
                data: [78, 123, 78, 61, 29, 64, 77, 59, 105, 138, 78, 89],
                name: 'Applications',
                type: 'bar',
                stack: false,
                barWidth: '25%',
                itemStyle: {
                    barGap: '0',
                    borderRadius: [2, 2, 2, 2],
                    color: 'var(--color-primary)',
                    borderWidth: 1,
                    borderColor: isDark ? 'var(--color-zinc-900)' : 'var(--color-white)',
                },
                emphasis: {
                    disabled: true
                },
            },
            {
                data: [25, 22, 16, 19, 16, 14, 23, 16, 17, 21, 12, 28],
                name: 'Jobs posted',
                type: 'bar',
                stack: false,
                barWidth: '25%',
                itemStyle: {
                    barGap: '0',
                    borderRadius: [2, 2, 2, 2],
                    color: 'var(--color-amber-500)',
                    borderWidth: 1,
                    borderColor: isDark ? 'var(--color-zinc-900)' : 'var(--color-white)',
                },
                emphasis: {
                    disabled: true
                },
            },
        ]
    };
}
function getOptionImpression(isDark) {
    const gridColor = isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-200)';
    const textColor = isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-600)';
    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            axisPointer: { type: 'shadow' },
            backgroundColor: isDark ? 'var(--color-zinc-800)' : 'var(--color-white)',
            borderColor: gridColor,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor,
                fontWeight: 400,
            },
             formatter: function(params) {
    const value = params.value;
    const name = params.name;
    const color = params.color || '#999';
    
    return `
      <div style="font-family: inherit; font-size: 14px;">
        <div style="margin-bottom: 4px;">${name}</div>
        <div style="color: ${color}; font-weight: 500;">
          ${value}k
        </div>
      </div>
    `;
  }
        },
        series: [
            {
                name: 'Impression',
                type: 'funnel',
                left: '0%',
                top: 0,
                bottom: 0,
                width: '100%',
                min: 0,
                max: 100,
                minSize: '0%',
                maxSize: '100%',
                sort: 'descending',
                gap: 2,
                label: {
        show: true,
        position: 'inside',
        color: '#fff',
        fontSize: 14,
        fontWeight: 'normal',
        fontFamily:'inherit',
      },
                labelLine: {
                    length: 10,
                    lineStyle: {
                        width: 1,
                        type: 'solid'
                    }
                },
                itemStyle: {
                    borderColor: isDark ? 'var(--color-zinc-900)' : 'var(--color-white)',
                    borderWidth: 1
                },
                emphasis: {
                    disabled: true
                },
                data: [
                    { value: 360, name: 'Direct',itemStyle:{color: 'var(--color-primary)'} },
                    { value: 120, name: 'Search',itemStyle:{color: 'var(--color-blue-500)'} },
                    { value: 70, name: 'Social',itemStyle:{color: 'var(--color-lime-500)'} },
                    { value: 40, name: 'Ads',itemStyle:{color: 'var(--color-amber-500)'} },
                ]
            }
        ]
    }
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
initChart(document.getElementById('chart_jobs'), getOptionJobs);
initChart(document.getElementById('chart_impression'), getOptionImpression);