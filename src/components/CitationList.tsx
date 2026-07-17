import type { Citation } from "@/lib/ragTypes"

interface CitationListProps {
  citations: Citation[]
}

export function CitationList({ citations }: CitationListProps) {
  if (!citations || citations.length === 0) return null

  return (
    <div className="mt-4 pt-3 border-t border-white/10">
      <p className="text-xs font-mono text-muted mb-2 uppercase tracking-wider">
        Sources
      </p>
      <ul className="space-y-1.5 m-0 p-0 list-none">
        {citations.map((citation) => (
          <li key={`${citation.articleId}-${citation.index}`} className="text-xs">
            <span className="inline-block min-w-[20px] text-muted-hover font-mono">
              [{citation.index}]
            </span>
            {citation.url ? (
              <a
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text hover:text-accent transition-colors duration-200 ml-1"
              >
                {citation.title}
              </a>
            ) : (
              <span className="text-text ml-1">{citation.title}</span>
            )}
            <span className="text-muted ml-2">
              ({new Date(citation.publishedAt).toLocaleDateString()})
            </span>
            {citation.sourceQualityScore !== null && (
              <span 
                className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted"
                title="Source Quality Score"
              >
                Q: {citation.sourceQualityScore.toFixed(2)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
