//Echarts for commerce dashboard
const charts = [];
function getOptionEarnings(isDark) {
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
            axisLine: { lineStyle: { color: gridColor,type:'dashed' } },
            axisLabel: {
                align: 'left',
                fontSize: 11,
                padding: [0, 0, 0, 0],
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
                color:  isDark ? 'var(--color-zinc-500)' : 'var(--color-zinc-400)',
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

function getOptionVisitorsVsSales(isDark) {
    const gridColor = isDark ? 'var(--color-zinc-800)' : 'var(--color-zinc-200)';
    const textColor = isDark ? 'var(--color-zinc-300)' : 'var(--color-zinc-500)';

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
            axisLine: { lineStyle: { color: gridColor,type:'dashed' } },
            axisLabel: {
                fontSize: 11,
                fontFamily: 'inherit',
                color:  isDark ? 'var(--color-zinc-500)' : 'var(--color-zinc-400)',
                padding: [0, 0, 0, 0]
            }
        },
        yAxis: {
            type: 'value',
            position: 'right',
             axisTick: 'none',
            axisLine: { show: false },
            axisLabel: {
                fontFamily: 'inherit',
                fontSize: 'var(--text-xs)',
                color:  isDark ? 'var(--color-zinc-500)' : 'var(--color-zinc-400)',
                formatter: value => value / 1000 + 'k'
            },
            splitLine: { lineStyle: { color: gridColor, type: 'dashed' } }
        },
        series: [
            {
                name: 'Visitors',
                type: 'bar',
                stack: 'total',
                barWidth: '35%',
                data: [100000, 120000, 90000, 150000, 130000, 160000, 140000, 180000, 150000, 200000, 170000, 210000],
                itemStyle: {
                    borderRadius: [10, 10, 10, 10],
                    color:'var(--color-amber-500)',
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
                barWidth: '35%',
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
function getOptionProjection(isDark) {
    return {
        backgroundColor: 'transparent',
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c}k ({d}%)',
            backgroundColor: isDark ? 'var(--color-zinc-900)' : 'var(--color-white)',
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
                borderRadius: 6,
                borderColor: isDark ? 'var(--color-zinc-900)' : '#fff',
                borderWidth: 6
            },
            data: [
                {
                    value: 93, name: 'Projection',
                    itemStyle: {
                        color: 'var(--color-amber-500)',
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
initChart(document.getElementById('chart_earnings'), getOptionEarnings);
initChart(document.getElementById('chart_visitors_sales'), getOptionVisitorsVsSales);
initChart(document.getElementById('chart_pie_projection'), getOptionProjection);


//Map
const markers = [
  { coords: [40.71, -74], name: "New York", Sales: '137K' },
  { coords: [35.68, 139.69], name: "Tokyo", Sales: '122K' },
  { coords: [28.61, 77.20], name: "Delhi", Sales: '119K' },
  { coords: [40.42, -3.70], name: "Madrid", Sales: '87K' }
];
const map = new jsVectorMap({
    map: "world",
    selector: "#world-map-markers",
    zoomOnScroll: false,
    zoomButtons: false,
    zoomAnimate: false,
    panOnDrag: false,
    backgroundColor: "transparent",

    regionStyle: {
        initial: {
            fill: "var(--color-primary-subtle)"
        },
         hover: {
    fill: "var(--color-primary)",
  },
    },
    markers: markers,

    markerStyle: {
        initial: {
            r: 6,
            fill: "var(--color-primary)",
            "fill-opacity": 0.9,
            stroke: "var(--color-primary-subtle)",
            "stroke-width": 3,
            "stroke-opacity": 0.6
        },
        hover: {
            fill: "var(--color-primary-deep)",
            "fill-opacity": 1,
            "stroke-width": 0
        }
    },
    onMarkerTooltipShow(event, tooltip, index) {
    const marker = markers[index];
    const html = `
      <h5 class="!text-white/70 px-2 pt-1 text-xs">${marker.name}</h5>
      <p class="font-semibold px-2">${marker.Sales} Sales</p>
    `;
    tooltip.text(html, true);
  }
});


//Tom select
document.querySelectorAll('.js-select').forEach(select => {
    new TomSelect(select, {
        maxItems: 1,
        create: false,
        searchField: [],
        controlInput: null
    });
});

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
      title:`<div class="flex items-start gap-3.5"><span class="icon-[lucide--triangle-alert] text-xl text-amber-500 mt-2"></span><div class="flex-grow"><h5 class="text-base">Attention required!</h5><p class="text-muted text-sm font-normal"> Your free trail ends in next 3 days.</p><a href="account-pricing.html" class="text-primary text-sm">Upgrade here <span class="icon-[lucide--external-link] ms-1"></span></a></div></div>`
    });
  };