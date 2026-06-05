type ArticleLinkFields = {
  id: string
  link?: string | null
  aiGenerated?: boolean | null
}

export function getArticleLink(article: ArticleLinkFields) {
  return getInternalArticleLink(article)
}

export function getInternalArticleLink(article: {
  id: string
  aiGenerated?: boolean | null
}) {
  return article.aiGenerated ? `/ai-news/${article.id}` : `/news/${article.id}`
}

export function isInternalArticleLink(link: string) {
  return link.startsWith("/")
}
