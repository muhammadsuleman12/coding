import type { StepContext } from "../context.server";
import { assertNoUserErrors, gql } from "../graphql.server";

export async function importBlogs(ctx: StepContext) {
  for (const blog of ctx.bundle.blogs ?? []) {
    let blogId = (await findBlog(ctx, blog.handle))?.id;
    if (blogId) {
      ctx.log(`Blog ${blog.handle} already exists`);
    } else {
      const data = await gql(
        ctx.admin,
        `#graphql
          mutation importerCreateBlog($blog: BlogCreateInput!) {
            blogCreate(blog: $blog) {
              blog {
                id
              }
              userErrors {
                field
                message
              }
            }
          }`,
        {
          blog: {
            handle: blog.handle,
            title: blog.title,
            templateSuffix: blog.templateSuffix,
          },
        },
      );
      assertNoUserErrors(`Blog ${blog.handle}`, data?.blogCreate?.userErrors);
      blogId = data?.blogCreate?.blog?.id;
      if (!blogId) throw new Error(`Blog ${blog.handle} was not created`);
      ctx.log(`Created blog ${blog.handle}`);
    }

    const existingArticles = new Set(
      (await findBlog(ctx, blog.handle))?.articles.nodes.map((a) => a.handle),
    );
    for (const article of blog.articles ?? []) {
      if (existingArticles.has(article.handle)) {
        ctx.log(`Article ${blog.handle}/${article.handle} already exists`);
        continue;
      }
      const data = await gql(
        ctx.admin,
        `#graphql
          mutation importerCreateArticle($article: ArticleCreateInput!) {
            articleCreate(article: $article) {
              article {
                id
              }
              userErrors {
                field
                message
              }
            }
          }`,
        {
          article: {
            blogId,
            handle: article.handle,
            title: article.title,
            author: { name: article.author },
            body: article.bodyHtml,
            summary: article.summaryHtml,
            tags: article.tags,
            templateSuffix: article.templateSuffix,
            isPublished: article.published ?? true,
            image: article.image
              ? { url: article.image.url, altText: article.image.alt }
              : undefined,
          },
        },
      );
      assertNoUserErrors(
        `Article ${blog.handle}/${article.handle}`,
        data?.articleCreate?.userErrors,
      );
      ctx.log(`Created article ${blog.handle}/${article.handle}`);
    }
  }
}

export async function findBlog(ctx: StepContext, handle: string) {
  const data = await gql(
    ctx.admin,
    `#graphql
      query importerFindBlog($query: String!) {
        blogs(first: 1, query: $query) {
          nodes {
            id
            handle
            articles(first: 250) {
              nodes {
                id
                handle
              }
            }
          }
        }
      }`,
    { query: `handle:'${handle}'` },
  );
  return data?.blogs.nodes.find((b) => b.handle === handle);
}
