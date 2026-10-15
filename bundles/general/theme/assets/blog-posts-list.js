import PaginatedList from '@forge/paginated-list';

/**
 * A custom element that renders a paginated blog posts list
 */
export default class BlogPostsList extends PaginatedList {}

if (!customElements.get('forge-blog-posts-list')) {
  customElements.define('forge-blog-posts-list', BlogPostsList);
}
