import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Mermaid } from './Mermaid';
import { cn } from '../lib/utils';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  isDarkTheme: boolean;
}

function createMarkdownComponents(isDarkTheme: boolean) {
  const colors = {
    text: isDarkTheme ? 'text-slate-200' : 'text-slate-700',
    heading1: isDarkTheme ? 'text-slate-50 border-slate-700' : 'text-slate-900 border-slate-200',
    heading2: isDarkTheme ? 'text-slate-100' : 'text-slate-800',
    heading3: isDarkTheme ? 'text-slate-100' : 'text-slate-800',
    muted: isDarkTheme ? 'text-slate-400' : 'text-slate-500',
    border: isDarkTheme ? 'border-slate-700' : 'border-slate-200',
    softBorder: isDarkTheme ? 'border-slate-800' : 'border-slate-100',
    panel: isDarkTheme ? 'bg-[#151b22]' : 'bg-white',
    panelSoft: isDarkTheme ? 'bg-[#10151b]' : 'bg-slate-50',
    code: isDarkTheme
      ? 'bg-slate-800 text-sky-100 border-slate-600'
      : 'bg-slate-200 text-slate-950 border-slate-300',
  };

  return {
    code({inline, className, children, ...props}: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';

      // Mermaid 图表交给独立组件渲染，避免普通代码高亮逻辑干扰图表交互。
      if (language === 'mermaid') {
        return <Mermaid chart={String(children).replace(/\n$/, '')} isDarkTheme={isDarkTheme} />;
      }

      return !inline && match ? (
        <div className={`relative group rounded-lg overflow-hidden my-6 shadow-sm border ${isDarkTheme ? 'border-slate-700 bg-slate-950' : 'border-slate-300 bg-slate-950'}`}>
          <div className="absolute right-3 top-3 text-[10px] text-slate-400 font-mono uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
            {language}
          </div>
          <SyntaxHighlighter
            {...props}
            style={vscDarkPlus}
            language={language}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: '1.5rem',
              fontSize: '0.9rem',
              borderRadius: '0px',
              background: '#0f172a',
            }}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className={cn(`rounded border px-1.5 py-0.5 font-mono text-[0.9em] font-medium ${colors.code}`, className)} {...props}>
          {children}
        </code>
      );
    },
    h1: ({children}: any) => <h1 className={`text-3xl font-bold tracking-tight mt-10 mb-6 border-b pb-2 ${colors.heading1}`}>{children}</h1>,
    h2: ({children}: any) => <h2 className={`text-2xl font-semibold tracking-tight mt-8 mb-4 ${colors.heading2}`}>{children}</h2>,
    h3: ({children}: any) => <h3 className={`text-xl font-medium tracking-tight mt-6 mb-3 ${colors.heading3}`}>{children}</h3>,
    p: ({children}: any) => <p className={`leading-7 mb-4 ${colors.text}`}>{children}</p>,
    ul: ({children}: any) => <ul className={`list-disc space-y-2 mb-4 ml-6 ${colors.text}`}>{children}</ul>,
    ol: ({children}: any) => <ol className={`list-decimal space-y-2 mb-4 ml-6 ${colors.text}`}>{children}</ol>,
    li: ({children}: any) => <li className="pl-1 leading-7">{children}</li>,
    a: ({children, href}: any) => (
      <a href={href} className={isDarkTheme ? 'text-sky-300 underline decoration-sky-500/50 underline-offset-4' : 'text-slate-900 underline decoration-slate-400 underline-offset-4'}>
        {children}
      </a>
    ),
    blockquote: ({children}: any) => (
      <blockquote className={`border-l-4 pl-6 italic my-6 py-4 rounded-r-lg ${isDarkTheme ? 'border-slate-600 bg-[#151b22] text-slate-300' : 'border-slate-300 bg-slate-50 text-slate-600'}`}>
        {children}
      </blockquote>
    ),
    table: ({children}: any) => (
      <div className={`markdown-table-scroll my-8 max-w-full overflow-x-auto rounded-lg border shadow-sm ${colors.border} ${colors.panel}`}>
        <table className="w-full table-fixed text-left text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({children}: any) => <thead className={`${colors.panelSoft} ${isDarkTheme ? 'text-slate-100' : 'text-slate-700'} font-semibold`}>{children}</thead>,
    tbody: ({children}: any) => <tbody className={colors.text}>{children}</tbody>,
    tr: ({children}: any) => <tr className={`border-b last:border-b-0 ${colors.softBorder}`}>{children}</tr>,
    th: ({children}: any) => (
      <th className={`px-4 py-3 align-top font-semibold border-r last:border-r-0 ${colors.softBorder}`}>
        <div className="break-words leading-6">
          {children}
        </div>
      </th>
    ),
    td: ({children}: any) => (
      <td className={`px-4 py-3 align-top border-r last:border-r-0 ${colors.softBorder}`}>
        <div className="max-w-[34rem] break-words leading-7">
          {children}
        </div>
      </td>
    ),
    img: ({src, alt}: any) => (
      <span className={`block my-8 overflow-hidden rounded-lg border p-3 ${colors.border} ${colors.panel}`}>
        <img src={src} alt={alt ?? ''} className="mx-auto max-h-[72vh] max-w-full object-contain" />
      </span>
    ),
    hr: () => <hr className={`my-10 border-0 border-t ${colors.border}`} />,
  };
}

const MarkdownPreviewComponent: React.FC<MarkdownPreviewProps> = ({content, className, isDarkTheme}) => {
  const components = React.useMemo(() => createMarkdownComponents(isDarkTheme), [isDarkTheme]);

  return (
    <div className={cn("prose prose-slate max-w-none prose-pre:bg-transparent prose-pre:p-0", isDarkTheme && "prose-invert", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// 父级切换 Zen、设置面板或编辑器可见性时，内容未变化就不重新解析 Markdown。
export const MarkdownPreview = memo(MarkdownPreviewComponent);
