## GET /cms/menu

Retrieve the current resources menu along with all children. Returns the following structure:

```ts
interface Menu {
   slug : string
   title: string
   child_menus : Menu[]
   posts : string[] # list of post slugs
}
```

## POST /cms/menu

Used to store the menu configuration in the DB (payload is same structure as above)

## GET /cms/posts

Retrieve all posts. Accepts parameter "include_content" if set, will return content for all posts, if not, omits that field.

Response format:

```ts
interface Post {
   id: string
   slug : string
   title: string
   content: string # content formatted as markdown
   updated_at: Date
   created_at: Date
   content_hash: string
}
```

## GET /cms/posts/{id}

Same as above

## POST /cms/posts/{id}

insert/update of a post (same payload as above)

## DELETE /cms/posts/{id}

Delete a post
