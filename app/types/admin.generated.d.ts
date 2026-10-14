/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.js';

export type ImporterPublicationsQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type ImporterPublicationsQuery = { publications: { nodes: Array<Pick<AdminTypes.Publication, 'id' | 'name'>> } };

export type ImporterPublishMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  input: Array<AdminTypes.PublicationInput> | AdminTypes.PublicationInput;
}>;


export type ImporterPublishMutation = { publishablePublish?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type ImporterCreateBlogMutationVariables = AdminTypes.Exact<{
  blog: AdminTypes.BlogCreateInput;
}>;


export type ImporterCreateBlogMutation = { blogCreate?: AdminTypes.Maybe<{ blog?: AdminTypes.Maybe<Pick<AdminTypes.Blog, 'id'>>, userErrors: Array<Pick<AdminTypes.BlogCreateUserError, 'field' | 'message'>> }> };

export type ImporterCreateArticleMutationVariables = AdminTypes.Exact<{
  article: AdminTypes.ArticleCreateInput;
}>;


export type ImporterCreateArticleMutation = { articleCreate?: AdminTypes.Maybe<{ article?: AdminTypes.Maybe<Pick<AdminTypes.Article, 'id'>>, userErrors: Array<Pick<AdminTypes.ArticleCreateUserError, 'field' | 'message'>> }> };

export type ImporterFindBlogQueryVariables = AdminTypes.Exact<{
  query: AdminTypes.Scalars['String']['input'];
}>;


export type ImporterFindBlogQuery = { blogs: { nodes: Array<(
      Pick<AdminTypes.Blog, 'id' | 'handle'>
      & { articles: { nodes: Array<Pick<AdminTypes.Article, 'id' | 'handle'>> } }
    )> } };

export type ImporterFindCollectionQueryVariables = AdminTypes.Exact<{
  handle: AdminTypes.Scalars['String']['input'];
}>;


export type ImporterFindCollectionQuery = { collectionByIdentifier?: AdminTypes.Maybe<Pick<AdminTypes.Collection, 'id'>> };

export type ImporterCreateCollectionMutationVariables = AdminTypes.Exact<{
  collection: AdminTypes.CollectionCreateInput;
}>;


export type ImporterCreateCollectionMutation = { collectionCreate?: AdminTypes.Maybe<{ collection?: AdminTypes.Maybe<Pick<AdminTypes.Collection, 'id'>>, userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>> }> };

export type ImporterFindCollectionProductQueryVariables = AdminTypes.Exact<{
  handle: AdminTypes.Scalars['String']['input'];
}>;


export type ImporterFindCollectionProductQuery = { productByIdentifier?: AdminTypes.Maybe<Pick<AdminTypes.Product, 'id'>> };

export type ImporterFindFileQueryVariables = AdminTypes.Exact<{
  query: AdminTypes.Scalars['String']['input'];
}>;


export type ImporterFindFileQuery = { files: { nodes: Array<Pick<AdminTypes.ExternalVideo, 'id'> | Pick<AdminTypes.GenericFile, 'id'> | Pick<AdminTypes.MediaImage, 'id'> | Pick<AdminTypes.Model3d, 'id'> | Pick<AdminTypes.Video, 'id'>> } };

export type ImporterCreateFileMutationVariables = AdminTypes.Exact<{
  files: Array<AdminTypes.FileCreateInput> | AdminTypes.FileCreateInput;
}>;


export type ImporterCreateFileMutation = { fileCreate?: AdminTypes.Maybe<{ files?: AdminTypes.Maybe<Array<Pick<AdminTypes.ExternalVideo, 'id'> | Pick<AdminTypes.GenericFile, 'id'> | Pick<AdminTypes.MediaImage, 'id'> | Pick<AdminTypes.Model3d, 'id'> | Pick<AdminTypes.Video, 'id'>>>, userErrors: Array<Pick<AdminTypes.FilesUserError, 'field' | 'message'>> }> };

export type ImporterFileStatusQueryVariables = AdminTypes.Exact<{
  ids: Array<AdminTypes.Scalars['ID']['input']> | AdminTypes.Scalars['ID']['input'];
}>;


export type ImporterFileStatusQuery = { nodes: Array<AdminTypes.Maybe<(
    Pick<AdminTypes.ExternalVideo, 'fileStatus'>
    & { fileErrors: Array<Pick<AdminTypes.FileError, 'message' | 'details'>> }
  ) | (
    Pick<AdminTypes.GenericFile, 'fileStatus'>
    & { fileErrors: Array<Pick<AdminTypes.FileError, 'message' | 'details'>> }
  ) | (
    Pick<AdminTypes.MediaImage, 'fileStatus'>
    & { fileErrors: Array<Pick<AdminTypes.FileError, 'message' | 'details'>> }
  ) | (
    Pick<AdminTypes.Model3d, 'fileStatus'>
    & { fileErrors: Array<Pick<AdminTypes.FileError, 'message' | 'details'>> }
  ) | (
    Pick<AdminTypes.Video, 'fileStatus'>
    & { fileErrors: Array<Pick<AdminTypes.FileError, 'message' | 'details'>> }
  )>> };

export type ImporterMenusQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type ImporterMenusQuery = { menus: { nodes: Array<Pick<AdminTypes.Menu, 'id' | 'handle' | 'isDefault'>> } };

export type ImporterUpdateMenuMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
  title: AdminTypes.Scalars['String']['input'];
  items: Array<AdminTypes.MenuItemUpdateInput> | AdminTypes.MenuItemUpdateInput;
}>;


export type ImporterUpdateMenuMutation = { menuUpdate?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.MenuUpdateUserError, 'field' | 'message'>> }> };

export type ImporterCreateMenuMutationVariables = AdminTypes.Exact<{
  title: AdminTypes.Scalars['String']['input'];
  handle: AdminTypes.Scalars['String']['input'];
  items: Array<AdminTypes.MenuItemCreateInput> | AdminTypes.MenuItemCreateInput;
}>;


export type ImporterCreateMenuMutation = { menuCreate?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.MenuCreateUserError, 'field' | 'message'>> }> };

export type ImporterMenuCollectionQueryVariables = AdminTypes.Exact<{
  handle: AdminTypes.Scalars['String']['input'];
}>;


export type ImporterMenuCollectionQuery = { collectionByIdentifier?: AdminTypes.Maybe<Pick<AdminTypes.Collection, 'id'>> };

export type ImporterMenuProductQueryVariables = AdminTypes.Exact<{
  handle: AdminTypes.Scalars['String']['input'];
}>;


export type ImporterMenuProductQuery = { productByIdentifier?: AdminTypes.Maybe<Pick<AdminTypes.Product, 'id'>> };

export type ImporterCreatePageMutationVariables = AdminTypes.Exact<{
  page: AdminTypes.PageCreateInput;
}>;


export type ImporterCreatePageMutation = { pageCreate?: AdminTypes.Maybe<{ page?: AdminTypes.Maybe<Pick<AdminTypes.Page, 'id'>>, userErrors: Array<Pick<AdminTypes.PageCreateUserError, 'field' | 'message'>> }> };

export type ImporterFindPageQueryVariables = AdminTypes.Exact<{
  query: AdminTypes.Scalars['String']['input'];
}>;


export type ImporterFindPageQuery = { pages: { nodes: Array<Pick<AdminTypes.Page, 'id' | 'handle'>> } };

export type ImporterUpdatePolicyMutationVariables = AdminTypes.Exact<{
  shopPolicy: AdminTypes.ShopPolicyInput;
}>;


export type ImporterUpdatePolicyMutation = { shopPolicyUpdate?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.ShopPolicyUserError, 'field' | 'message'>> }> };

export type ImporterPoliciesQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type ImporterPoliciesQuery = { shop: { shopPolicies: Array<Pick<AdminTypes.ShopPolicy, 'id' | 'type' | 'body'>> } };

export type ImporterFindProductQueryVariables = AdminTypes.Exact<{
  handle: AdminTypes.Scalars['String']['input'];
}>;


export type ImporterFindProductQuery = { productByIdentifier?: AdminTypes.Maybe<Pick<AdminTypes.Product, 'id'>> };

export type ImporterSetProductMutationVariables = AdminTypes.Exact<{
  input: AdminTypes.ProductSetInput;
}>;


export type ImporterSetProductMutation = { productSet?: AdminTypes.Maybe<{ product?: AdminTypes.Maybe<Pick<AdminTypes.Product, 'id'>>, userErrors: Array<Pick<AdminTypes.ProductSetUserError, 'field' | 'message'>> }> };

export type ImporterProductMediaQueryVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type ImporterProductMediaQuery = { product?: AdminTypes.Maybe<{ media: { nodes: Array<(
        Pick<AdminTypes.ExternalVideo, 'alt' | 'status'>
        & { mediaErrors: Array<Pick<AdminTypes.MediaError, 'message' | 'details'>> }
      ) | (
        Pick<AdminTypes.MediaImage, 'alt' | 'status'>
        & { mediaErrors: Array<Pick<AdminTypes.MediaError, 'message' | 'details'>> }
      ) | (
        Pick<AdminTypes.Model3d, 'alt' | 'status'>
        & { mediaErrors: Array<Pick<AdminTypes.MediaError, 'message' | 'details'>> }
      ) | (
        Pick<AdminTypes.Video, 'alt' | 'status'>
        & { mediaErrors: Array<Pick<AdminTypes.MediaError, 'message' | 'details'>> }
      )> } }> };

export type ImporterFindRedirectQueryVariables = AdminTypes.Exact<{
  query: AdminTypes.Scalars['String']['input'];
}>;


export type ImporterFindRedirectQuery = { urlRedirects: { nodes: Array<Pick<AdminTypes.UrlRedirect, 'path'>> } };

export type ImporterCreateRedirectMutationVariables = AdminTypes.Exact<{
  urlRedirect: AdminTypes.UrlRedirectInput;
}>;


export type ImporterCreateRedirectMutation = { urlRedirectCreate?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.UrlRedirectUserError, 'field' | 'message'>> }> };

interface GeneratedQueryTypes {
  "#graphql\n      query importerPublications {\n        publications(first: 50) {\n          nodes {\n            id\n            name\n          }\n        }\n      }": {return: ImporterPublicationsQuery, variables: ImporterPublicationsQueryVariables},
  "#graphql\n      query importerFindBlog($query: String!) {\n        blogs(first: 1, query: $query) {\n          nodes {\n            id\n            handle\n            articles(first: 250) {\n              nodes {\n                id\n                handle\n              }\n            }\n          }\n        }\n      }": {return: ImporterFindBlogQuery, variables: ImporterFindBlogQueryVariables},
  "#graphql\n        query importerFindCollection($handle: String!) {\n          collectionByIdentifier(identifier: { handle: $handle }) {\n            id\n          }\n        }": {return: ImporterFindCollectionQuery, variables: ImporterFindCollectionQueryVariables},
  "#graphql\n        query importerFindCollectionProduct($handle: String!) {\n          productByIdentifier(identifier: { handle: $handle }) {\n            id\n          }\n        }": {return: ImporterFindCollectionProductQuery, variables: ImporterFindCollectionProductQueryVariables},
  "#graphql\n        query importerFindFile($query: String!) {\n          files(first: 1, query: $query) {\n            nodes {\n              id\n            }\n          }\n        }": {return: ImporterFindFileQuery, variables: ImporterFindFileQueryVariables},
  "#graphql\n        query importerFileStatus($ids: [ID!]!) {\n          nodes(ids: $ids) {\n            ... on File {\n              fileStatus\n              fileErrors {\n                message\n                details\n              }\n            }\n          }\n        }": {return: ImporterFileStatusQuery, variables: ImporterFileStatusQueryVariables},
  "#graphql\n      query importerMenus {\n        menus(first: 100) {\n          nodes {\n            id\n            handle\n            isDefault\n          }\n        }\n      }": {return: ImporterMenusQuery, variables: ImporterMenusQueryVariables},
  "#graphql\n        query importerMenuCollection($handle: String!) {\n          collectionByIdentifier(identifier: { handle: $handle }) {\n            id\n          }\n        }": {return: ImporterMenuCollectionQuery, variables: ImporterMenuCollectionQueryVariables},
  "#graphql\n        query importerMenuProduct($handle: String!) {\n          productByIdentifier(identifier: { handle: $handle }) {\n            id\n          }\n        }": {return: ImporterMenuProductQuery, variables: ImporterMenuProductQueryVariables},
  "#graphql\n      query importerFindPage($query: String!) {\n        pages(first: 1, query: $query) {\n          nodes {\n            id\n            handle\n          }\n        }\n      }": {return: ImporterFindPageQuery, variables: ImporterFindPageQueryVariables},
  "#graphql\n      query importerPolicies {\n        shop {\n          shopPolicies {\n            id\n            type\n            body\n          }\n        }\n      }": {return: ImporterPoliciesQuery, variables: ImporterPoliciesQueryVariables},
  "#graphql\n        query importerFindProduct($handle: String!) {\n          productByIdentifier(identifier: { handle: $handle }) {\n            id\n          }\n        }": {return: ImporterFindProductQuery, variables: ImporterFindProductQueryVariables},
  "#graphql\n        query importerProductMedia($id: ID!) {\n          product(id: $id) {\n            media(first: 250) {\n              nodes {\n                alt\n                status\n                mediaErrors {\n                  message\n                  details\n                }\n              }\n            }\n          }\n        }": {return: ImporterProductMediaQuery, variables: ImporterProductMediaQueryVariables},
  "#graphql\n        query importerFindRedirect($query: String!) {\n          urlRedirects(first: 1, query: $query) {\n            nodes {\n              path\n            }\n          }\n        }": {return: ImporterFindRedirectQuery, variables: ImporterFindRedirectQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n      mutation importerPublish($id: ID!, $input: [PublicationInput!]!) {\n        publishablePublish(id: $id, input: $input) {\n          userErrors {\n            field\n            message\n          }\n        }\n      }": {return: ImporterPublishMutation, variables: ImporterPublishMutationVariables},
  "#graphql\n          mutation importerCreateBlog($blog: BlogCreateInput!) {\n            blogCreate(blog: $blog) {\n              blog {\n                id\n              }\n              userErrors {\n                field\n                message\n              }\n            }\n          }": {return: ImporterCreateBlogMutation, variables: ImporterCreateBlogMutationVariables},
  "#graphql\n          mutation importerCreateArticle($article: ArticleCreateInput!) {\n            articleCreate(article: $article) {\n              article {\n                id\n              }\n              userErrors {\n                field\n                message\n              }\n            }\n          }": {return: ImporterCreateArticleMutation, variables: ImporterCreateArticleMutationVariables},
  "#graphql\n        mutation importerCreateCollection($collection: CollectionCreateInput!) {\n          collectionCreate(collection: $collection) {\n            collection {\n              id\n            }\n            userErrors {\n              field\n              message\n            }\n          }\n        }": {return: ImporterCreateCollectionMutation, variables: ImporterCreateCollectionMutationVariables},
  "#graphql\n        mutation importerCreateFile($files: [FileCreateInput!]!) {\n          fileCreate(files: $files) {\n            files {\n              id\n            }\n            userErrors {\n              field\n              message\n            }\n          }\n        }": {return: ImporterCreateFileMutation, variables: ImporterCreateFileMutationVariables},
  "#graphql\n          mutation importerUpdateMenu($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) {\n            menuUpdate(id: $id, title: $title, items: $items) {\n              userErrors {\n                field\n                message\n              }\n            }\n          }": {return: ImporterUpdateMenuMutation, variables: ImporterUpdateMenuMutationVariables},
  "#graphql\n          mutation importerCreateMenu($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {\n            menuCreate(title: $title, handle: $handle, items: $items) {\n              userErrors {\n                field\n                message\n              }\n            }\n          }": {return: ImporterCreateMenuMutation, variables: ImporterCreateMenuMutationVariables},
  "#graphql\n        mutation importerCreatePage($page: PageCreateInput!) {\n          pageCreate(page: $page) {\n            page {\n              id\n            }\n            userErrors {\n              field\n              message\n            }\n          }\n        }": {return: ImporterCreatePageMutation, variables: ImporterCreatePageMutationVariables},
  "#graphql\n        mutation importerUpdatePolicy($shopPolicy: ShopPolicyInput!) {\n          shopPolicyUpdate(shopPolicy: $shopPolicy) {\n            userErrors {\n              field\n              message\n            }\n          }\n        }": {return: ImporterUpdatePolicyMutation, variables: ImporterUpdatePolicyMutationVariables},
  "#graphql\n        mutation importerSetProduct($input: ProductSetInput!) {\n          productSet(input: $input, synchronous: true) {\n            product {\n              id\n            }\n            userErrors {\n              field\n              message\n            }\n          }\n        }": {return: ImporterSetProductMutation, variables: ImporterSetProductMutationVariables},
  "#graphql\n        mutation importerCreateRedirect($urlRedirect: UrlRedirectInput!) {\n          urlRedirectCreate(urlRedirect: $urlRedirect) {\n            userErrors {\n              field\n              message\n            }\n          }\n        }": {return: ImporterCreateRedirectMutation, variables: ImporterCreateRedirectMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
