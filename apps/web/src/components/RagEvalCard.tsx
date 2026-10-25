'use client';

import { useEffect, useState } from 'react';
import type { RagEval } from '@mars-explorer/shared';
import { getRagEval } from '@/lib/api';

/** Public retrieval-quality summary for /pipeline (science reproducibility). */
export default function RagEvalCard() {
  const [evalResult, setEvalResult] = useState<RagEval | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getRagEval()
      .then(setEvalResult)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <section className="theater-section" aria-label="RAG evaluation">
      <div className="theater-section-head"><span>RAG EVAL / LABELLED QUESTIONS</span><span>RETRIEVAL QUALITY</span></div>
      {error && <p className="compare-note">Eval unavailable: {error}. Start the API and ensure the corpus index is built.</p>}
      {evalResult && (
        <div className="pipeline-status">
          <div><small>QUESTIONS</small><strong>{evalResult.questions}</strong><span>Labelled probes in data/rag/eval.json</span></div>
          <div><small>SEMANTIC</small><strong>{evalResult.semantic ? 'ON' : 'BM25 ONLY'}</strong><span>Dense embeddings when an embed key is configured.</span></div>
          {evalResult.rows.map((row) => (
            <div key={row.mode}>
              <small>{row.mode.toUpperCase()}</small>
              <strong>R@3 {(row.recallAt3 * 100).toFixed(0)}% · R@5 {(row.recallAt5 * 100).toFixed(0)}%</strong>
              <span>MRR {row.mrr.toFixed(2)}{evalResult.misses.length ? ` · ${evalResult.misses.length} miss(es)` : ''}</span>
            </div>
          ))}
        </div>
      )}
      {!evalResult && !error && <p className="compare-note">Loading /rag/eval…</p>}
    </section>
  );
}
