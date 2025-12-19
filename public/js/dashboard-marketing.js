//dashboard charts

const charts = [];

function getOptionAds(isDark) {
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
            data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            axisLine: { lineStyle: { color: gridColor, type: 'dashed' } },
            axisLabel: {
                align: 'left',
                fontSize: 'var(--text-sm)',
                padding: [0, 0, 0, -10],
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
                fontSize: 'var(--text-sm)',
                color: isDark ? 'var(--color-zinc-500)' : 'var(--color-zinc-400)',
                formatter: value => value / 1000 + 'k'
            },
            splitLine: { lineStyle: { color: gridColor, type: 'dashed' } }
        },
        series: [
            
            {
                name: 'Campaign',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 7,
                showSymbol: true,
                emphasis: {
                   disabled:true
                },
                lineStyle: { color: 'var(--color-yellow-500)' },
                itemStyle: { color: 'var(--color-yellow-500)' },
                data: [1200, 1020, 900, 1070, 1700, 1440, 1620, 1900, 1340, 1670, 950, 820]
            },
            {
                name: 'Emails',
                type: 'bar',
                barWidth: '40%',
                data: [453, 846, 699, 759, 1210, 1880, 930, 1170, 710, 620, 1190, 870],
                itemStyle: {
                    borderRadius: [10, 10, 10, 10],
                    color: 'var(--color-primary)',
                },
                emphasis: {
                    disabled: true
                },
            },
             
        ]
    };
}

function getOptionLead(isDark) {
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
            }
        },
        grid: {
            right: '40px',
            left: '0px',
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
            position: 'right',
            axisTick: 'none',
            type: 'category',
            data: ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F'],
            axisLine: { show: false, lineStyle: { color: gridColor } },
            axisLabel:{
                padding: [0, 0, 0, -15],
                color: isDark ? 'var(--color-zinc-500)' : 'var(--color-zinc-400)',
                fontFamily: 'inherit',
            },
            splitLine: {show:true, lineStyle: { color: gridColor, type: 'dashed' } }
        },
        series: [{
          name: 'Campaigns',
          type: 'bar',
          stack: 'total',
          data: [1405, 1300, 1620, 1430, 1500, 1520],
          barWidth: '50%',
          itemStyle: {
                    borderRadius: [3, 3, 3, 3],
                    color: 'var(--color-primary)',
                    borderWidth: 2,
                    borderColor: isDark ? 'var(--color-zinc-900)' : 'var(--color-white)',
                },
                emphasis: {
                    disabled: true
                }
        }, {
          name: 'Lead',
          type: 'bar',
          stack: 'total',
          data: [320, 302, 301, 334, 340, 390],
          barWidth: '50%',
          itemStyle: {
                    borderRadius: [3, 3, 3, 3],
                    color: 'var(--color-amber-500)',
                    borderWidth: 2,
                    borderColor: isDark ? 'var(--color-zinc-900)' : 'var(--color-white)',
                },
                emphasis: {
                    disabled: true
                }
        }, {
          name: 'Opportunity',
          type: 'bar',
          stack: 'total',
          data: [220, 182, 351, 234, 290, 300],
          barWidth: '50%',
          itemStyle: {
                    borderRadius: [3, 3, 3, 3],
                    color: 'var(--color-sky-500)',
                    borderWidth: 2,
                    borderColor: isDark ? 'var(--color-zinc-900)' : 'var(--color-white)',
                },
                emphasis: {
                    disabled: true
                }
        }, {
          name: 'Deal',
          type: 'bar',
          stack: 'total',
          data: [120, 182, 191, 134, 190, 170],
          barWidth: '50%',
          itemStyle: {
                    borderRadius: [3, 3, 3, 3],
                    color: 'var(--color-cyan-500)',
                    borderWidth: 2,
                    borderColor: isDark ? 'var(--color-zinc-900)' : 'var(--color-white)',
                },
                emphasis: {
                    disabled: true
                }
        }],
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
initChart(document.getElementById('chart_visitor'), getOptionAds);
initChart(document.getElementById('chart_lead'), getOptionLead);