# Coding Standards

## API Layer Rules

- No direct DB calls – all DB access must go through the `crud` layer.
- **Function parameter** order:

  1. Request parameters / Request body
  2. `db: Annotated[SessionWithUser, Depends(get_db_with_user)]`
  3. `user: Annotated[str, Depends(get_user)]`
  4. Other dependencies
     - e.g. `dataset: Annotated[DatasetModel, Depends(get_dataset_dep)]`
     - `settings: Annotated[Settings, Depends(get_settings)]`

- **Access control**:
  - Users without write access but in the dataset’s group → return **403 Forbidden**.
  - Users outside the dataset’s group → return **404 Not Found** (prevents info leakage).

### Defining a New API Route

- **For devs**: Write a proposal first (use case, parameters, response format).
- Use plural nouns for REST endpoint paths.
- Create a new file for each route prefix (e.g., `/datasets` → `api/datasets.py`).
- Group endpoints with the same prefix into the same file.
- Add comments for each new route – more documentation is better than less.

---

## API Params

### Dependencies

Defined in `breadbox/breadbox/api/dependencies.py`. See more about [FastAPI dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/#create-a-dependency-or-dependable)

Common dependencies:

- `get_db_with_user` – include in all DB-accessing routes.
- `get_user` – include in all routes to enforce access control.
- `get_dataset` – include for all `/dataset` endpoints that takes in a dataset as path parameter.

### Validating Parameters

Better typing allows FastAPI to generate a more informative OpenAPI doc which is helpful for some of our downstream processes to consume

**General rules of thumb:**

- Use detailed _type hints_ and _Pydantic models_.
- Prefer [`Annotated`](https://fastapi.tiangolo.com/python-types/#type-hints-with-metadata-annotations) for parameters with dependencies or validation (e.g., [query params](https://fastapi.tiangolo.com/tutorial/query-param-models/#query-parameters-with-a-pydantic-model)).
- Avoid using `assert` in the API layer — proper typing and dependencies should remove the need.
- In request bodies, use _Pydantic Models_:
  - Type request body fields with [`Field`](https://fastapi.tiangolo.com/tutorial/body-fields/#import-field) when needed
  - [Field validations](https://docs.pydantic.dev/latest/concepts/validators/#field-validators) - especially logic where there are cross-field dependencies

---

## API Responses

- Define a **Pydantic response model** whenever possible.
- Set it in the FastAPI route decorator using `response_model=`.

---

## Data/CRUD Layer Rules

- Only layer with DB access
- All _public methods_ (no leading `_`):
  - Must check permissions before querying DB.
  - Must accept a `user` parameter.
- **Function parameter order**:
  1. `db: SessionWithUser`
  2. `user: str`
  3. `settings: Settings`
  4. Other parameters

---

## Errors

Errors should be informative to both the our logs and UI.

- Use **enums** to define _error types_ (mirrored in frontend TypeScript types).
- Each _error type_ maps to a _custom exception class_ inheriting from `FastAPI.HTTPException`.

_NOTE: Above rules are based off [recent proposal](https://docs.google.com/document/d/1PtR4aS8vdhk0voYIlp_lL2TVfhTZCluhbHbNKJmMsdc/edit?tab=t.0#heading=h.fnr7rg2653gf)_

---

## Tests

- Test folder structure should mirror the application folder structure.
- Focus is on testing **API responses**, but complex logic in other layers should also be tested.
- [`breadbox/tests/factories.py`](../tests/factories.py) – defines reusable test/data objects.
