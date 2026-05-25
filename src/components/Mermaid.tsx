import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';

interface MermaidProps {
  chart: string;
  isDarkTheme: boolean;
}

const mermaidFontFamily = '"Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Source Han Sans CN", sans-serif';

function getMermaidThemeVariables(isDarkTheme: boolean) {
  if (isDarkTheme) {
    return {
      background: '#11161c',
      mainBkg: '#1b232d',
      primaryColor: '#1f2937',
      primaryTextColor: '#e5e7eb',
      primaryBorderColor: '#94a3b8',
      secondaryColor: '#17212b',
      secondaryTextColor: '#e5e7eb',
      secondaryBorderColor: '#64748b',
      tertiaryColor: '#111827',
      tertiaryTextColor: '#e5e7eb',
      tertiaryBorderColor: '#64748b',
      lineColor: '#94a3b8',
      noteBkgColor: '#1f2937',
      noteTextColor: '#e5e7eb',
      noteBorderColor: '#64748b',
      fontSize: '15px',
      nodeBorder: '#64748b',
      clusterBkg: '#151b22',
      clusterBorder: '#475569',
      defaultLinkColor: '#94a3b8',
      titleColor: '#f8fafc',
      edgeLabelBackground: '#11161c',
      labelTextColor: '#e5e7eb',
      textColor: '#e5e7eb',
    };
  }

  return {
    background: '#ffffff',
    mainBkg: '#ffffff',
    primaryColor: '#f3f4f6',
    primaryTextColor: '#111827',
    primaryBorderColor: '#4b5563',
    secondaryColor: '#f9fafb',
    secondaryTextColor: '#111827',
    secondaryBorderColor: '#6b7280',
    tertiaryColor: '#f3f4f6',
    tertiaryTextColor: '#111827',
    tertiaryBorderColor: '#9ca3af',
    lineColor: '#374151',
    noteBkgColor: '#fefce8',
    noteTextColor: '#854d0e',
    noteBorderColor: '#fde047',
    fontSize: '15px',
    nodeBorder: '#cbd5e1',
    clusterBkg: '#f9fafb',
    clusterBorder: '#9ca3af',
    defaultLinkColor: '#4b5563',
    titleColor: '#0f172a',
    edgeLabelBackground: '#ffffff',
    labelTextColor: '#111827',
    textColor: '#1e293b',
  };
}

function configureMermaid(isDarkTheme: boolean) {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'loose',
    // Mermaid 11 会在语法错误时默认把错误图写进 DOM；应用自己展示错误即可。
    suppressErrorRendering: true,
    fontFamily: mermaidFontFamily,
    themeVariables: getMermaidThemeVariables(isDarkTheme),
  });
}

function createMermaidRenderTarget() {
  const target = document.createElement('div');
  target.setAttribute('aria-hidden', 'true');
  target.style.position = 'fixed';
  target.style.left = '-10000px';
  target.style.top = '-10000px';
  target.style.width = '1px';
  target.style.height = '1px';
  target.style.overflow = 'hidden';
  document.body.appendChild(target);
  return target;
}

function parseSvgColor(color: string | null) {
  if (!color || color === 'none' || color === 'transparent') return null;

  const hexMatch = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hexMatch) return null;

  const hex = hexMatch[1].length === 3
    ? hexMatch[1].split('').map((value) => value + value).join('')
    : hexMatch[1];

  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function pickReadableTextColor(fillColor: string | null, isDarkTheme: boolean) {
  const rgb = parseSvgColor(fillColor);
  if (!rgb) {
    return isDarkTheme ? '#e5e7eb' : '#111827';
  }

  // YIQ brightness is enough here because Mermaid nodes are flat fills.
  // Light fills get dark text; dark fills get light text.
  const brightness = (rgb.red * 299 + rgb.green * 587 + rgb.blue * 114) / 1000;
  return brightness >= 150 ? '#111827' : '#f8fafc';
}

function getSvgViewBoxSize(svgElement: SVGSVGElement) {
  const viewBox = svgElement.viewBox?.baseVal;
  if (!viewBox || viewBox.width <= 0 || viewBox.height <= 0) return null;

  return {
    width: viewBox.width,
    height: viewBox.height,
  };
}

export const Mermaid: React.FC<MermaidProps> = ({ chart, isDarkTheme }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const transformRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reactId = useId().replace(/:/g, '');

  const resetDiagramView = useCallback(() => {
    const transform = transformRef.current;
    if (!transform) return;

    // 容器尺寸变化后先让浏览器完成布局，再按新边界恢复初始比例和居中。
    window.requestAnimationFrame(() => {
      transform.resetTransform(0);
      window.requestAnimationFrame(() => {
        transform.centerView(1, 0);
      });
    });
  }, []);

  useEffect(() => {
    let isCurrentRender = true;
    const renderTarget = createMermaidRenderTarget();

    const renderChart = async () => {
      if (!chart) {
        setSvg('');
        setError(null);
        return;
      }

      try {
        setError(null);
        setSvg('');
        configureMermaid(isDarkTheme);
        const uniqueId = `mermaid-${reactId}-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, chart, renderTarget);
        if (!isCurrentRender) return;

        setSvg(renderedSvg);
      } catch (err: any) {
        if (!isCurrentRender) return;

        console.error('Mermaid rendering failed:', err);
        setSvg('');
        setError('Mermaid 语法错误，请检查代码。');
      } finally {
        renderTarget.remove();
      }
    };

    renderChart();

    return () => {
      isCurrentRender = false;
      renderTarget.remove();
    };
  }, [chart, isDarkTheme, reactId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !svg) return;

    // Mermaid 输出里有 SVG text，也有 HTML label。等 SVG 放进 DOM 后再改
    // 节点文字颜色，可以避免重新序列化整段 SVG 导致图表结构损坏。
    container.querySelectorAll('.node').forEach((node) => {
      const shape = node.querySelector('rect, circle, ellipse, polygon, path');
      const fillColor = shape?.getAttribute('fill') || shape?.getAttribute('style')?.match(/fill:\s*([^;]+)/)?.[1] || null;
      const textColor = pickReadableTextColor(fillColor, isDarkTheme);

      node.querySelectorAll<HTMLElement | SVGElement>('text, tspan, .label, .label span, .nodeLabel').forEach((label) => {
        label.setAttribute('fill', textColor);
        label.setAttribute('color', textColor);
        label.style.fill = textColor;
        label.style.color = textColor;
      });
    });

    container.querySelectorAll<SVGSVGElement>('svg').forEach((svgElement) => {
      const viewBoxSize = getSvgViewBoxSize(svgElement);
      if (!viewBoxSize) return;

      // Mermaid 默认输出 width="100%"，横向图会被压到容器宽度后高度变得很小。
      // 这里恢复 viewBox 对应的自然尺寸，把“是否缩放”交给外层缩放组件处理。
      svgElement.style.width = `${viewBoxSize.width}px`;
      svgElement.style.height = `${viewBoxSize.height}px`;
      svgElement.style.maxWidth = 'none';
    });
  }, [svg, isDarkTheme]);

  useEffect(() => {
    resetDiagramView();
  }, [svg, isFullScreen, resetDiagramView]);

  if (error) {
    return (
      <div className={`p-4 border rounded-lg text-sm font-mono my-4 ${isDarkTheme ? 'bg-red-950/40 border-red-900 text-red-200' : 'bg-red-50 border-red-100 text-red-600'}`}>
        {error}
      </div>
    );
  }

  const shellClass = isFullScreen
    ? `fixed inset-0 z-50 p-6 md:p-10 ${isDarkTheme ? 'bg-[#11161c]' : 'bg-white'}`
    : `rounded-lg border shadow-sm hover:shadow-md ${isDarkTheme ? 'border-slate-700 bg-[#151b22]' : 'border-slate-200 bg-white'}`;
  const toolbarClass = isDarkTheme
    ? 'bg-[#151b22]/95 border-slate-700 text-slate-300'
    : 'bg-white/95 border-slate-200 text-slate-500';
  const iconButtonClass = isDarkTheme
    ? 'text-slate-300 hover:text-white hover:bg-slate-800'
    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100';

  return (
    <div className={`relative group my-8 transition-colors ${shellClass}`} data-theme={isDarkTheme ? 'dark' : 'light'}>
      <TransformWrapper
        key={`${svg.length}-${isFullScreen ? 'full' : 'inline'}`}
        ref={transformRef}
        initialScale={1}
        minScale={0.2}
        maxScale={8}
        centerOnInit
        limitToBounds={false}
      >
        {({ zoomIn, zoomOut }) => (
          <>
            <div className={`absolute top-4 right-4 z-10 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md border p-2 rounded-lg shadow-xl ${toolbarClass}`}>
              <button
                onClick={() => zoomIn()}
                className={`p-2 rounded-lg transition-colors ${iconButtonClass}`}
                title="放大"
              >
                <ZoomIn size={18} />
              </button>
              <button
                onClick={() => zoomOut()}
                className={`p-2 rounded-lg transition-colors ${iconButtonClass}`}
                title="缩小"
              >
                <ZoomOut size={18} />
              </button>
              <button
                onClick={resetDiagramView}
                className={`p-2 rounded-lg transition-colors ${iconButtonClass}`}
                title="重置视图"
              >
                <RotateCcw size={18} />
              </button>
              <div className={`w-px h-5 mx-1 ${isDarkTheme ? 'bg-slate-700' : 'bg-slate-200'}`} />
              <button
                onClick={() => setIsFullScreen((value) => !value)}
                className={`p-2 rounded-lg transition-colors ${isFullScreen ? iconButtonClass : iconButtonClass}`}
                title={isFullScreen ? "退出全屏" : "全屏查看"}
              >
                <Maximize2 size={18} />
              </button>
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className={`${isDarkTheme ? 'bg-slate-950/90 text-slate-100' : 'bg-slate-900/85 text-white'} backdrop-blur text-[10px] font-medium px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2`}>
                <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-pulse" />
                滚动缩放 · 拖拽移动
              </div>
            </div>

            <div className={`overflow-hidden cursor-grab active:cursor-grabbing ${isFullScreen ? 'h-full' : 'h-[520px]'}`}>
              <TransformComponent
                wrapperStyle={{
                  width: '100%',
                  height: '100%',
                }}
                contentStyle={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 'max-content',
                  height: 'max-content',
                }}
              >
                <div
                  ref={containerRef}
                  className="mermaid-container inline-block p-10 transition-colors"
                  data-theme={isDarkTheme ? 'dark' : 'light'}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              </TransformComponent>
            </div>
          </>
        )}
      </TransformWrapper>

    </div>
  );
};
