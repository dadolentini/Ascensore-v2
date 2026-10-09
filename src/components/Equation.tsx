import katex from 'katex';
import { useMemo } from 'react';

interface EquationProps { tex: string; label: string; number?: string; }

/** KaTeX emits visual HTML and accessible MathML; overflow stays local. */
export default function Equation({ tex, label, number }: EquationProps) {
  const markup = useMemo(() => katex.renderToString(tex, {
    displayMode: true, output: 'htmlAndMathml', throwOnError: false,
    trust: false, strict: 'warn',
  }), [tex]);
  return <figure className="equation">
    <div className="equation-scroll" tabIndex={0} role="group" aria-label={`Formula: ${label}. Scorri orizzontalmente se necessario.`}>
      <div dangerouslySetInnerHTML={{ __html: markup }} />
    </div>
    <figcaption>{number && <span className="equation-number">{number} · </span>}{label}</figcaption>
  </figure>;
}
import 'katex/dist/katex.min.css';
