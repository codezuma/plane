import { computed, makeObservable, observable, runInAction } from "mobx";
import isEmpty from "lodash/isEmpty";
import set from "lodash/set";
// base class
import { IssueFilterHelperStore } from "../helpers/issue-filter-helper.store";
// helpers
import { handleIssueQueryParamsByLayout } from "helpers/issue.helper";
// types
import { IIssueRootStore } from "../root.store";
import {
  IIssueFilterOptions,
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties,
  IIssueFilters,
  TIssueParams,
} from "@plane/types";
// constants
import { EIssueFilterType } from "constants/issue";
// services
import { IssueFiltersService } from "services/issue_filter.service";

export interface IModuleIssuesFilter {
  // observables
  filters: Record<string, IIssueFilters>; // Record defines moduleId as key and IIssueFilters as value
  // computed
  issueFilters: IIssueFilters | undefined;
  appliedFilters: Partial<Record<TIssueParams, string | boolean>> | undefined;
  // action
  fetchFilters: (workspaceSlug: string, projectId: string, moduleId: string) => Promise<void>;
  updateFilters: (
    workspaceSlug: string,
    projectId: string,
    filterType: EIssueFilterType,
    filters: IIssueFilterOptions | IIssueDisplayFilterOptions | IIssueDisplayProperties,
    moduleId?: string | undefined
  ) => Promise<void>;
}

export class ModuleIssuesFilter extends IssueFilterHelperStore implements IModuleIssuesFilter {
  // observables
  filters: { [moduleId: string]: IIssueFilters } = {};
  // root store
  rootIssueStore: IIssueRootStore;
  // services
  issueFilterService;

  constructor(_rootStore: IIssueRootStore) {
    super();
    makeObservable(this, {
      // observables
      filters: observable,
      // computed
      issueFilters: computed,
      appliedFilters: computed,
    });
    // root store
    this.rootIssueStore = _rootStore;
    // services
    this.issueFilterService = new IssueFiltersService();
  }

  get issueFilters() {
    const moduleId = this.rootIssueStore.moduleId;
    if (!moduleId) return undefined;

    const displayFilters = this.filters[moduleId] || undefined;
    if (isEmpty(displayFilters)) return undefined;

    const _filters: IIssueFilters = this.computedIssueFilters(displayFilters);

    return _filters;
  }

  get appliedFilters() {
    const userFilters = this.issueFilters;
    if (!userFilters) return undefined;

    const filteredParams = handleIssueQueryParamsByLayout(userFilters?.displayFilters?.layout, "issues");
    if (!filteredParams) return undefined;

    const filteredRouteParams: Partial<Record<TIssueParams, string | boolean>> = this.computedFilteredParams(
      userFilters?.filters as IIssueFilterOptions,
      userFilters?.displayFilters as IIssueDisplayFilterOptions,
      filteredParams
    );

    if (userFilters?.displayFilters?.layout === "gantt_chart") filteredRouteParams.start_target_date = true;

    return filteredRouteParams;
  }

  fetchFilters = async (workspaceSlug: string, projectId: string, moduleId: string) => {
    try {
      const _filters = await this.issueFilterService.fetchModuleIssueFilters(workspaceSlug, projectId, moduleId);

      const filters: IIssueFilterOptions = this.computedFilters(_filters?.filters);
      const displayFilters: IIssueDisplayFilterOptions = this.computedDisplayFilters(_filters?.display_filters);
      const displayProperties: IIssueDisplayProperties = this.computedDisplayProperties(_filters?.display_properties);

      runInAction(() => {
        set(this.filters, [moduleId, "filters"], filters);
        set(this.filters, [moduleId, "displayFilters"], displayFilters);
        set(this.filters, [moduleId, "displayProperties"], displayProperties);
      });
    } catch (error) {
      throw error;
    }
  };

  updateFilters = async (
    workspaceSlug: string,
    projectId: string,
    type: EIssueFilterType,
    filters: IIssueFilterOptions | IIssueDisplayFilterOptions | IIssueDisplayProperties,
    moduleId: string | undefined = undefined
  ) => {
    try {
      if (!moduleId) throw new Error("Module id is required");
      if (isEmpty(this.filters) || isEmpty(this.filters[projectId]) || isEmpty(filters)) return;

      const _filters = {
        filters: this.filters[projectId].filters as IIssueFilterOptions,
        displayFilters: this.filters[projectId].displayFilters as IIssueDisplayFilterOptions,
        displayProperties: this.filters[projectId].displayProperties as IIssueDisplayProperties,
      };

      switch (type) {
        case EIssueFilterType.FILTERS:
          const updatedFilters = filters as IIssueFilterOptions;
          _filters.filters = { ..._filters.filters, ...updatedFilters };

          runInAction(() => {
            Object.keys(updatedFilters).forEach((_key) => {
              set(this.filters, [moduleId, "filters", _key], updatedFilters[_key as keyof IIssueFilterOptions]);
            });
          });

          this.rootIssueStore.projectIssues.fetchIssues(workspaceSlug, projectId, "mutation");
          await this.issueFilterService.patchModuleIssueFilters(workspaceSlug, projectId, moduleId, {
            filters: _filters.filters,
          });
          break;
        case EIssueFilterType.DISPLAY_FILTERS:
          const updatedDisplayFilters = filters as IIssueDisplayFilterOptions;
          _filters.displayFilters = { ..._filters.displayFilters, ...updatedDisplayFilters };

          // set sub_group_by to null if group_by is set to null
          if (_filters.displayFilters.group_by === null) {
            _filters.displayFilters.sub_group_by = null;
            updatedDisplayFilters.sub_group_by = null;
          }
          // set sub_group_by to null if layout is switched to kanban group_by and sub_group_by are same
          if (
            _filters.displayFilters.layout === "kanban" &&
            _filters.displayFilters.group_by === _filters.displayFilters.sub_group_by
          ) {
            _filters.displayFilters.sub_group_by = null;
            updatedDisplayFilters.sub_group_by = null;
          }
          // set group_by to state if layout is switched to kanban and group_by is null
          if (_filters.displayFilters.layout === "kanban" && _filters.displayFilters.group_by === null) {
            _filters.displayFilters.group_by = "state";
            updatedDisplayFilters.group_by = "state";
          }

          runInAction(() => {
            Object.keys(updatedDisplayFilters).forEach((_key) => {
              set(
                this.filters,
                [moduleId, "displayFilters", _key],
                updatedDisplayFilters[_key as keyof IIssueDisplayFilterOptions]
              );
            });
          });

          await this.issueFilterService.patchModuleIssueFilters(workspaceSlug, projectId, moduleId, {
            display_filters: _filters.displayFilters,
          });

          break;
        case EIssueFilterType.DISPLAY_PROPERTIES:
          const updatedDisplayProperties = filters as IIssueDisplayProperties;
          _filters.displayProperties = { ..._filters.displayProperties, ...updatedDisplayProperties };

          runInAction(() => {
            Object.keys(updatedDisplayProperties).forEach((_key) => {
              set(
                this.filters,
                [moduleId, "displayProperties", _key],
                updatedDisplayProperties[_key as keyof IIssueDisplayProperties]
              );
            });
          });

          await this.issueFilterService.patchModuleIssueFilters(workspaceSlug, projectId, moduleId, {
            display_properties: _filters.displayProperties,
          });
          break;
        default:
          break;
      }
    } catch (error) {
      if (moduleId) this.fetchFilters(workspaceSlug, projectId, moduleId);
      throw error;
    }
  };
}
