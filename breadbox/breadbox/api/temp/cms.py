from typing import Dict, Any, List
import re

from sqlalchemy.sql.annotation import Annotated

from .router import router
from ...service import cms
from fastapi import Request, Depends
from ..dependencies import get_cms_client

# this endpoint exists to decouple the front end from payload by preventing any direct access. This
# has a few advantages:
#
# 1. The front end doesn't need to worry about access to payload, just access to breadbox. From the perspective
#    of the front end, there's only breadbox.
# 2. We can add a caching layer inside breadbox to avoid every page requesting content from payload. This
#    will allow us to freely restart payload/taking it offline for periods of time without impacting
#    any running portals. As a design principal, we want every portal to only rely on the services running
#    on the deployed server as much as possible to isolate ourselves from other services' outages.


@router.get("/cms/{collection_type}", operation_id="get_cms_documents")
async def get_cms_documents(
    collection_type: str,
    request: Request,
    payload_client: Annotated[cms.PayloadClient, Depends(get_cms_client)],
) -> List[Dict[str, Any]]:
    """
    Retrieve documents from Payload CMS with filtering.

    Query parameters format: prop.<property_name>.eq=<value>

    Example:
        GET /cms/posts?prop.status.eq=published&prop.author.eq=john
    """

    # Parse query parameters
    filters = {}
    query_params = dict(request.query_params)

    for key, value in query_params.items():
        # Parse prop.<property_name>.eq format
        m = re.match("prop\\.([^.]+)\\.eq")
        if m:
            # Extract property name
            prop_name = m.group(1)
            filters[prop_name] = value

    # Fetch documents from Payload CMS
    result = await payload_client.fetch(collection_type, filters)

    return result
