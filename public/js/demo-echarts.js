//ChartsDemo

const charts = [];
function getOptionArea(isDark) {
    const gridColor = isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-200)';
    const textColor = isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-500)';
    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-50)',
            borderColor: gridColor,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor
            },
            formatter: function (params) {
                const value = params[0].value;
                return `${params[0].axisValue}<br/><span>$${value} USD</span>`;
            }
        },
        grid: {
            right: '35px',
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
            data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
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
            splitLine: { lineStyle: { color: gridColor, type: 'dashed' } }
        },
        series: [
            {
                type: 'line',
                data: [27000, 51000, 44000, 68000, 52000, 74000, 59000, 82000, 64000, 87000, 72000, 94000],
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
function getOptionLine(isDark) {
    const gridColor = isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-200)';
    const textColor = isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-500)';

    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-50)',
            borderColor: gridColor,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor
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
            data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
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
            splitLine: { lineStyle: { color: gridColor, type: 'dashed' } }
        },
        series: [
            {
                name: 'Organic',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 7,
                showSymbol: false,
                emphasis: {
                    lineStyle: { color: 'var(--color-primary)' },
                    itemStyle: { color: 'var(--color-primary)' },
                },
                lineStyle: { color: 'var(--color-primary)' },
                itemStyle: { color: 'var(--color-primary)' },
                data: [87000, 57000, 74000, 98000, 74000, 44000, 62000, 49000, 82000, 56000, 47000, 54000]
            },
            {
                name: 'Referral',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 7,
                showSymbol: false,
                emphasis: {
                    lineStyle: { color: 'var(--color-sky-500)' },
                    itemStyle: { color: 'var(--color-sky-500)' },
                },
                lineStyle: { color: 'var(--color-sky-500)' },
                itemStyle: { color: 'var(--color-sky-500)' },
                data: [35000, 41000, 62000, 42000, 14000, 18000, 29000, 37000, 36000, 5100, 32000, 34000]
            },
            {
                name: 'Ads',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 7,
                showSymbol: false,
                lineStyle: { color: 'var(--color-yellow-500)', type: 'dashed' },
                itemStyle: { color: 'var(--color-yellow-500)' },
                emphasis: {
                    lineStyle: { color: 'var(--color-yellow-500)' },
                    itemStyle: { color: 'var(--color-yellow-500)' },
                },
                data: [45000, 52000, 38000, 24000, 33000, 24000, 21000, 19000, 64000, 84000, 16000, 18000]
            }
        ]
    };
}

function getOptionBar(isDark) {
    const gridColor = isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-200)';
    const textColor = isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-500)';

    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            backgroundColor: isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-50)',
            borderColor: gridColor,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor
            },
            formatter: function (params) {
                let tooltip = `${params[0].axisValue}<br/>`;
                params.forEach(p => {
                    const valueInK = (p.value / 1000).toFixed(1);
                    tooltip += `<span style="display:inline-block;margin-right:5px;border-radius:50%;width:8px;height:8px;background-color:${p.color}"></span> ${p.seriesName}: ${valueInK}k<br/>`;
                });
                return tooltip;
            }
        },
        grid: {
            left: '0px',
            right: '40px',
            bottom: '60px',
            top: '3%'
        },
        legend: {
            bottom: 0,
            itemGap: 20,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor
            }
        },
        xAxis: {
            type: 'category',
            data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: {
                fontSize: 11,
                fontFamily: 'inherit',
                color: textColor,
                padding: [0, 0, 0, 5]
            }
        },
        yAxis: {
            type: 'value',
            position: 'right',
            axisLine: { show: false },
            axisLabel: {
                fontFamily: 'inherit',
                fontSize: 'var(--text-xs)',
                color: textColor,
                formatter: value => value / 1000 + 'k'
            },
            splitLine: { lineStyle: { color: gridColor, type: 'dashed' } }
        },
        series: [
            {
                name: 'Visitors',
                type: 'bar',
                stack: 'total',
                barWidth: '40%',
                data: [100000, 120000, 90000, 150000, 130000, 160000, 140000, 180000, 150000, 200000, 170000, 210000],
                itemStyle: {
                    borderRadius: [10, 10, 10, 10],
                    color: isDark ? 'var(--color-zinc-600)' : 'var(--color-zinc-300)',
                    borderWidth: 2,
                    borderColor: isDark ? 'var(--color-zinc-900)' : 'var(--color-white)',
                },
                emphasis: {
                    disabled: true
                }
            },
            {
                name: 'Sales',
                type: 'bar',
                stack: 'total',
                barWidth: '40%',
                data: [40000, 70000, 60000, 100000, 90000, 120000, 110000, 140000, 120000, 160000, 150000, 170000],
                itemStyle: {
                    barGap: '10%',
                    borderRadius: [10, 10, 10, 10],
                    color: 'var(--color-primary)',
                    borderWidth: 2,
                    borderColor: isDark ? 'var(--color-zinc-900)' : 'var(--color-white)',
                },
                emphasis: {
                    disabled: true
                }
            }
        ]
    };
}
function getOptionPolar(isDark) {
    const gridColor = isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-200)';
    const textColor = isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-500)';
    return {
        backgroundColor: 'transparent',
        tooltip: {
            backgroundColor: isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-50)',
            textStyle: {
                fontFamily: 'inherit',
                color: textColor
            },
            formatter: function (params) {
                return `${params.name}: $${params.value}k`;
            },
        },
        polar: {
            radius: [30, '80%']
        },
        radiusAxis: {
            max: 40,
            splitLine: {
                lineStyle: {
                    color: gridColor,
                    width: 1
                }
            },
            axisLine: {
                show: false
            },
            axisLabel: {
                show: false
            },
            axisTick: {
                show: false
            }
        },
        angleAxis: {
            type: 'category',
            data: ['Visitors', 'Sales', 'Profit', 'Expanses'],
            startAngle: 75,
            axisLine: {
                lineStyle: {
                    color: gridColor
                }
            },
            axisLabel: {
                color: textColor,
                
            fontFamily:'inherit',
            }
        },
        series: {
            type: 'bar',
            data: [37, 23, 14, 7],
            coordinateSystem: 'polar',

            label: {
                show: false,
                position: 'middle',
                formatter: '{b}: {c}'
            },
            itemStyle: {
                color: function (params) {
                    const colors = [
                        'var(--color-sky-500)',
                        'var(--color-amber-500)',
                        'var(--color-primary)',
                        'var(--color-rose-500)'
                    ];
                    return colors[params.dataIndex % colors.length];
                },
            },
            emphasis: {
                disabled: true
            }
        },
    };
}
function getOptionPie(isDark) {
    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c}k ({d}%)',
            backgroundColor: isDark ? 'var(--color-zinc-900)' : 'var(--color-zinc-50)',
            textStyle: {
                fontFamily: 'inherit',
                color: isDark ? 'var(--color-zinc-100)' : 'var(--color-zinc-600)'
            }
        },
        legend: {
            show: false,
            top: '0px',
            textStyle: {
                color: isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-500)',
                fontFamily: 'inherit',
            },
            itemGap: 20,
        },
        series: [{
            name: 'Visitors',
            type: 'pie',
            radius: ['70%', '90%'],
            avoidLabelOverlap: false,
            selectedMode: false,
            startAngle: 90,
            label: {
                fontFamily: 'inherit',
                show: true,
                position: 'center',
                formatter: '-12k',
                fontSize: 36,
                fontWeight: 'var(--font-semibold)',
                color: isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-600)',
            },
            emphasis: { disabled: true },
            labelLine: { show: false },
            itemStyle: {
                borderRadius: 12,
                borderColor: isDark ? 'var(--color-zinc-900)' : '#fff',
                borderWidth: 6
            },
            data: [
                {
                    value: 93, name: 'Projection',
                    itemStyle: {
                        color: isDark ? 'var(--color-zinc-600)' : 'var(--color-zinc-300)',
                    }
                },
                {
                    value: 81, name: 'Actual',
                    itemStyle: {
                        color: 'var(--color-primary)'
                    }
                },
            ]
        }]
    };
}
function getOptionMix(isDark) {
    const gridColor = isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-200)';
    const textColor = isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-500)';

    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'axis',
            backgroundColor: isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-50)',
            borderColor: gridColor,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor
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
            itemGap: 30,
            textStyle: {
                fontFamily: 'inherit',
                color: textColor
            }
        },
        xAxis: {
            type: 'category',
            boundaryGap: true,
            data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            axisLine: { lineStyle: { color: gridColor } },
            axisLabel: {
                align: 'left',
                fontSize: 'var(--text-sm)',
                padding: [0, 0, 0, -10],
                showMaxLabel: false,
                color: textColor,
                fontFamily: 'inherit',
            }
        },
        yAxis: {
            position: 'right',
            axisTick: 'none',
            type: 'value',
            axisLine: { show: false, lineStyle: { color: gridColor, type: 'dashed' } },
            axisLabel: {
                fontFamily: 'inherit',
                fontSize: 'var(--text-sm)',
                color: textColor,
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
                    disabled: true
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
initChart(document.getElementById('chart_area'), getOptionArea);
initChart(document.getElementById('chart_bar'), getOptionBar);
initChart(document.getElementById('chart_pie'), getOptionPie);
initChart(document.getElementById('chart_polar'), getOptionPolar);
initChart(document.getElementById('chart_mix'), getOptionMix);
initChart(document.getElementById('chart_line'), getOptionLine);
