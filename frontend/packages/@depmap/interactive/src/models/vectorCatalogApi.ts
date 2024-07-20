/* eslint-disable */
import { OptionsInfo, OptionsInfoSelected, Catalog } from "./interactive";

const rename = (object: any, oldName: string, newName: string) => {
  if (!Object.prototype.hasOwnProperty.call(object, oldName)) {
    throw `Unable to rename; no property ${oldName} found`;
  }
  object[newName] = object[oldName];
  delete object[oldName];
};

interface VectorCatalogApiInterface {
  getVectorCatalogChildren: (
    catalog: Catalog,
    id: string,
    prefix?: string
  ) => Promise<any>;

  getVectorCatalogPath: (catalog: Catalog, id: string) => Promise<Array<any>>;
}

export class VectorCatalogApi {
  bbapi: VectorCatalogApiInterface;

  constructor(bbapi: VectorCatalogApiInterface) {
    this.bbapi = bbapi;
  }

  renameOptionsInfo = (response: any) => {
    function renameChild(child: any) {
      rename(child, "childValue", "optionValue");
      return child;
    }
    rename(response, "category", "placeholder");
    rename(response, "persistChildIfNotFound", "persistSelectedIfNotFound");
    response.children = response.children.map(renameChild);
    return <OptionsInfo>response;
  };

  getVectorCatalogOptions = (
    catalog: Catalog,
    id: string,
    prefix = ""
  ): Promise<OptionsInfo> => {
    // maps vocabulary from what the back end sends, to terms that make sense for the VectorCatalog component
    return this.bbapi
      .getVectorCatalogChildren(catalog, id, prefix)
      .then((response: any) => {
        return this.renameOptionsInfo(response);
      });
  };

  getVectorCatalogPath(
    catalog: Catalog,
    id: string
  ): Promise<Array<OptionsInfoSelected>> {
    // maps vocabulary from what the back end sends, to terms that make sense for the VectorCatalog component
    return this.bbapi
      .getVectorCatalogPath(catalog, id)
      .then((response: Array<any>) => {
        return response.map((path: any) => {
          path = this.renameOptionsInfo(path);
          return path;
        });
      });
  }
}
