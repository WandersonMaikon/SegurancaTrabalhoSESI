//dashboard analytic charts

const charts = [];
function getOptionTinyBounceArea(isDark) {
    const gridColor = isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-200)';
    const textColor = isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-500)';
    return {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line' },
            backgroundColor: isDark ? 'var(--color-zinc-800)' : 'var(--color-white)',
            borderColor: gridColor,
            textStyle: { color: textColor,fontWeight:400, },
            formatter: function (params) {
                const value = params[0].value;
                return `${params[0].axisValue}<br/><span>${value}%</span>`;
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
            data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            boundaryGap: false,
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
                type: 'line',
                data: [13, 31, 56, 24, 59, 41, 58],
                symbol: 'none',
                smooth: true,
                // areaStyle: {
                //     color: {
                //         type: 'linear',
                //         x: 0,
                //         y: 0,
                //         x2: 0,
                //         y2: 1,
                //         colorStops: [{
                //             offset: 0,
                //             color: 'var(--color-primary-subtle)'
                //         }, {
                //             offset: 1,
                //             color: 'rgba(0,0,0,0)'
                //         }]
                //     }
                // },
                lineStyle: {
                    color: 'var(--color-primary)',
                    width: 2
                },
                emphasis: {
                    disabled:true
                },
            }
        ]
    };
}
function getOptionTinyBar(isDark) {
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
            data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
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
                data: [320, 452, 301, 334, 390, 330, 410],
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
            data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
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
                name: 'Organic',
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
                name: 'Referral',
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 7,
                showSymbol: false,
                emphasis: {
                     disabled:true
                },
                lineStyle: { color: 'var(--color-rose-500)' },
                itemStyle: { color: 'var(--color-rose-500)' },
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
                    disabled:true
                },
                data: [45000, 52000, 38000, 24000, 33000, 24000, 21000, 19000, 64000, 84000, 16000, 18000]
            }
        ]
    };
}
function getOptionPie(isDark) {
    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c}k ({d}%)',
            backgroundColor: isDark ? 'var(--color-zinc-800)' : 'var(--color-white)',
            textStyle: {
                fontFamily: 'inherit',fontWeight:400,
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
                formatter: '1.5M',
                fontSize: 36,
                fontWeight: 'var(--font-semibold)',
                color: isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-600)',
            },
            emphasis: { disabled: true },
            labelLine: { show: false },
            itemStyle: {
                borderRadius: 6,
                borderColor: isDark ? 'var(--color-zinc-900)' : '#fff',
                borderWidth: 6
            },
            data: [
                { value: 58, name: 'India', itemStyle: { color: 'var(--color-primary)' } },
                { value: 44, name: 'USA', itemStyle: { color: 'var(--color-sky-500)' } },
                { value: 31, name: 'UK', itemStyle: { color: 'var(--color-yellow-500)' } },
                { value: 23, name: 'France', itemStyle: { color: 'var(--color-orange-500)' } }
            ]
        }]
    };
}
function getOptionPolar(isDark) {
    const gridColor = isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-200)';
    const textColor = isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-500)';
    return {
        backgroundColor: 'transparent',
        tooltip: {
            backgroundColor: isDark ? 'var(--color-zinc-800)' : 'var(--color-white)',
            textStyle: {
                fontFamily: 'inherit',
                color: textColor,
                fontWeight:400
            },
            formatter: (params) => {
        const value = params.name === 'Visitors' ? `${params.value}k` : `$${params.value}k`;
        return `${params.name}: ${value}`;
    },
        },
        polar: {
            radius: [30, '70%']
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
                color: isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-500)',
                margin: 4,
                align: 'center',
                verticalAlign: 'top',
                fontSize:'12px',
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
initChart(document.getElementById('chart_visitor'), getOptionLine);
initChart(document.getElementById('chart_pie_countries'), getOptionPie);
initChart(document.getElementById('chart_tiny_weekly_sales'), getOptionTinyBar);
initChart(document.getElementById('chart_tiny_weekly_bounce_rate'), getOptionTinyBounceArea);
initChart(document.getElementById('chart_polar'), getOptionPolar);



//Toast
window.onload = function() {
    Swal.fire({
      toast: true,
      position: 'top',
      showConfirmButton: false,
      timer: 4000,
      timerProgressBar: true,
      showCloseButton: true,
      closeButtonHtml: '<span class="icon-[lucide--x]"></span>',
      title:`<div class="flex items-start gap-3.5"><span class=""text-xl">✨</span><div class="flex-grow"><h5 class="text-base">Welcome to Raven Admin</h5><p class="text-sm font-normal">Manage smarter with a clean, modern admin system built for speed, and clarity</p><a href="https://wrapmarket.com/item/raven-tailwindcss-admin-template-ui-kit-WB0B6DKC2/?via=wb_rakesh" class="text-primary text-sm">Purchase here <span class="icon-[lucide--external-link] ms-1"></span></a></div></div>`
    });
  };