//dashboard charts

const charts = [];

function getOptionTopics(isDark) {
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
                color: textColor,fontWeight:400
            },
              formatter: function (params) {
        let result = '';
        params.forEach(function (item) {
            result += item.marker + ' ' + item.seriesName + ': ' + item.value + '%<br/>';
        });
        return result;
    }
        },
        grid: {
            right: '40px',
            left: '70px',
            bottom: '30px',
            top: '0'
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
            type: 'value',
            boundaryGap: true,
            
            axisLine: {lineStyle: { color: gridColor } },
            axisLabel: {
                align: 'left',
                fontSize: 'var(--text-sm)',
                padding: [0, 0, 0, 0],
                showMaxLabel: false,
                color: isDark ? 'var(--color-zinc-500)' : 'var(--color-zinc-400)',
                fontFamily: 'inherit',
            },
            splitLine: {show:false, lineStyle: { color: gridColor } }
        },
        yAxis: {
            position: 'left',
            axisTick: 'none',
            type: 'category',
            data: ['UI design', 'React', 'Angular', 'Python', 'Animation', 'Svelte'],
            axisLine: { show: false, lineStyle: { color: gridColor } },
            axisLabel:{
                padding: [0, 0, 0,0],
                color: isDark ? 'var(--color-zinc-500)' : 'var(--color-zinc-400)',
                fontFamily: 'inherit',
            },
            splitLine: {show:true, lineStyle: { color: gridColor, type: 'dashed' } }
        },
        series: [{
          name: 'Your interest rate is',
          type: 'bar',
          data: [80, 60, 55, 50, 40, 25],
          barWidth: '50%',
          label: {
    show: true,
    position: 'right',
    formatter: '{c}%',
    color: isDark ? 'var(--color-zinc-200)' : 'var(--color-zinc-700)',
    fontFamily: 'inherit',
    fontSize: 12
  },
          itemStyle: {
                    borderRadius: [3, 3, 3, 3],
                    color: function(params) {
        const colors = [
            'var(--color-primary)',
            'var(--color-amber-500)',
            'var(--color-sky-500)',
            'var(--color-cyan-500)',
            'var(--color-green-500)',
            'var(--color-purple-500)'
        ];
        return colors[params.dataIndex];
    },
                    borderWidth: 2,
                    borderColor: isDark ? 'var(--color-zinc-900)' : 'var(--color-white)',
                },
                emphasis: {
                    disabled: true
                }
        }],
    };
}
function getOptionWeeklyReport(isDark) {
    const gridColor = isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-200)';
    const textColor = isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-500)';
    return {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: isDark ? 'var(--color-zinc-800)' : 'var(--color-white)',
            borderColor: gridColor,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor,fontWeight:400,
            }
        },
        grid: {
            left: 0,
            right: 0,
            top: 10,
            bottom: 0,
            containLabel: false
        },
        xAxis: {
            type: 'category',
            data: ['Week1', 'Week2', 'Week3', 'Week4', 'Week5', 'Week6', 'Week7', 'Week8', 'Week9', 'Week10'],
            axisLine: { show: false },
            axisTick: { show: false },
            axisLabel: { show: false }
        },
        yAxis: {
            type: 'value',
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false }
        },
        series: [
            {
                type: 'bar',
                data: [24, 40, 31, 28, 38, 18, 24, 19, 14, 28],
                barWidth: '30%',
                itemStyle: {
                    color: 'var(--color-primary)',
                    borderRadius: [4, 4, 4, 4]
                },
                emphasis: {
                    itemStyle: {
                        color: 'var(--color-primary)',
                    },
                }
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
const themeObserver = new MutationObserver(rerenderAll);
themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
});
window.addEventListener('resize', () => {
    charts.forEach(({ chart }) => chart.resize());
});

// Initialize all charts
initChart(document.getElementById('chart_topics'), getOptionTopics);
initChart(document.getElementById('chart_weekly_report'), getOptionWeeklyReport);
