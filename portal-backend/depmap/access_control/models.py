import re
from dataclasses import dataclass, field
from typing import Dict, List


# THIS NUMBER IS SPECIAL AND RESERVED FOR THE PUBLIC GROUP
PUBLIC_ACCESS_GROUP = 0


@dataclass
class GroupAuthConfig:
    display_name: str  # note that downloads match based on display name. Changing the name may require also modifying downloads
    description: str
    is_admin_group: bool = False
    users: List[str] = field(default_factory=list)
    email_domains: List[str] = field(
        default_factory=list
    )  # e.g. broadinstitute.org, without the @ sign
    owner_id: int = -1


PUBLIC_ACCESS_GROUP_AUTH_CONFIG = GroupAuthConfig(
    display_name="Public",  # this matches the default value for the DownloadRelease constructor
    description="All accounts",
    owner_id=PUBLIC_ACCESS_GROUP,
)


class AuthorizationConfig:
    # The statically initialized configuration constructed from the json datastructure
    # via create_authorization_config()
    def __init__(
        self, admin_users: List[str], groups: Dict[int, GroupAuthConfig],
    ):
        assert isinstance(admin_users, list)
        assert isinstance(groups, dict)
        group_display_names = [group.display_name for _, group in groups.items()]
        assert len(group_display_names) == len(
            set(group_display_names)
        )  # assert all display names are unique

        self.admin_users: List[str] = admin_users
        self.groups: Dict[int, GroupAuthConfig] = groups

    def get_allowed_owner_ids(self, user_id: str) -> Dict[int, GroupAuthConfig]:
        """
        Given a user id, returns a dictionary of group_ids: groups that user should
        have access to
        """
        owner_ids: Dict[int, GroupAuthConfig] = {
            PUBLIC_ACCESS_GROUP: PUBLIC_ACCESS_GROUP_AUTH_CONFIG
        }

        for owner_id, group in self.groups.items():
            if user_id in group.users:
                owner_ids[owner_id] = group
                continue

            if any(
                user_id.endswith("@" + email_domain)
                for email_domain in group.email_domains
            ):
                owner_ids[owner_id] = group

        return owner_ids

    def is_admin(self, user_id: str):
        return user_id in self.admin_users


class CurrentAuthorizations:
    """
    We want this to be lazily computed based on the current user
        It is thus stored on flask.g, which is new for every request

    We cache the "allowed" properties (authenticated_allowed and allowed_override)
        the could be lazily evaluated every time
        however, they are used and called for every db row retrieval
        so we cache them here for performance reasons
    """

    def __init__(
        self,
        authenticated_user_id: str,
        authenticated_allowed: Dict[int, GroupAuthConfig],
        authenticated_user_is_admin: bool,
        user_id_override: str = None,
        allowed_override: Dict[int, GroupAuthConfig] = None,
    ):
        self.authenticated_user_id = authenticated_user_id
        self._authenticated_allowed = authenticated_allowed
        self._user_id_override = user_id_override
        self._allowed_override = allowed_override
        self.is_everything_visible = False
        self.is_admin = authenticated_user_is_admin

    @property
    def user_id(self):
        """
        Return the override if present, otherwise the original one
        """
        return (
            self._user_id_override
            if self._user_id_override
            else self.authenticated_user_id
        )

    @property
    def allowed(self):
        """
        Return the override if present, otherwise the original one
        """
        return (
            self._allowed_override
            if self._allowed_override
            else self._authenticated_allowed
        )
