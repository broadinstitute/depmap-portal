import React, { useCallback, useState } from "react";
import {
  MenuItem,
  Nav,
  Navbar,
  NavDropdown,
  SelectCallback,
} from "react-bootstrap";
import {
  createSearchParams,
  Link,
  LinkProps,
  useNavigate,
} from "react-router-dom";
import { breadboxAPI } from "@depmap/api";
import BannerSvg from "src/BannerSvg";
import { SearchBar, SearchResponse } from "./pages/SearchBar";
import launchContextManagerModal from "src/modals/launchContextManagerModal";

type MenuItemLinkProps = LinkProps & { onSelect?: SelectCallback };

// Use this instead of trying to do <MenuItem><Link /></MenuItem>. Why? Sadly,
// those two components do not compose well. Each will create its own <a> tag
// and the HTML spec says those shouldn't be nested (it will still work but
// React's validateDOMNesting() will yell at you). This implements the little
// bit of magic that makes a MenuItem close on click (an onSelect prop is
// transparently injected by the parent <NavDropdown> component and that needs
// to be called on click).
function MenuItemLink({ onSelect = undefined, ...rest }: MenuItemLinkProps) {
  const handleClick = (event: React.MouseEvent & { eventKey?: unknown }) => {
    if (onSelect) {
      onSelect(event.eventKey, event);
    }
  };

  return (
    <li role="presentation">
      <Link role="menuitem" onClick={handleClick} {...rest} />
    </li>
  );
}

function ElaraNavbar() {
  // TODO: Needs to be cleaned up
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<string[]>([]);

  const handleSearch = useCallback(
    async (query: string) => {
      if (query === "") {
        setOptions([]);
        return;
      }

      setIsLoading(true);

      await breadboxAPI
        .getSearchOptions(query)
        .then((searchResponse: SearchResponse) => {
          setOptions(searchResponse.labels);
          setIsLoading(false);
        });
    },
    [setIsLoading, setOptions]
  );

  const navigate = useNavigate();

  const handleChange = useCallback(
    (selected: string[]) => {
      if (selected[0]) {
        const label = selected[0];
        const params = { label };

        setOptions([]);

        navigate({
          pathname: "/elara/metadata",
          search: `?${createSearchParams(params)}`,
        });
      }
    },
    [setOptions, navigate]
  );

  return (
    <Navbar className="elara-nav" inverse fixedTop>
      <Navbar.Header>
        <Navbar.Brand>
          <Link to="/elara">
            <BannerSvg />
          </Link>
        </Navbar.Brand>
      </Navbar.Header>
      <Navbar.Form pullLeft>
        <SearchBar
          handleSearch={handleSearch}
          handleChange={handleChange}
          options={options}
          searchPlaceholder="Search for dimension metadata..."
          isLoading={isLoading}
        />
      </Navbar.Form>
      <Nav>
        <NavDropdown id="elara-tools-menu" className="tools" title="Tools">
          <MenuItemLink to="/elara">Data Explorer</MenuItemLink>
          <MenuItemLink to="/elara/datasets">Manage Datasets</MenuItemLink>
          <MenuItemLink to="/elara/sample_types">
            Manage Sample Types
          </MenuItemLink>
          <MenuItemLink to="/elara/feature_types">
            Manage Feature Types
          </MenuItemLink>
          <MenuItemLink to="/elara/custom_downloads">
            Custom Downloads
          </MenuItemLink>
          <MenuItemLink to="/elara/custom_analysis">
            Custom Analyses
          </MenuItemLink>
          <MenuItemLink to="/elara/groups">Manage Groups</MenuItemLink>
          <MenuItem divider />
          <MenuItem onClick={() => launchContextManagerModal()}>
            Context Manager
          </MenuItem>
        </NavDropdown>
      </Nav>
    </Navbar>
  );
}

export default ElaraNavbar;
