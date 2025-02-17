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
  IIssueFiltersResponse,
} from "@plane/types";
// constants
import { EIssueFilterType, EIssuesStoreType } from "constants/issue";
// services
import { WorkspaceService } from "services/workspace.service";

type TWorkspaceFilters = "all-issues" | "assigned" | "created" | "subscribed" | string;
export interface IWorkspaceIssuesFilter {
  // observables
  filters: Record<TWorkspaceFilters, IIssueFilters>; // Record defines viewId as key and IIssueFilters as value
  // computed
  issueFilters: IIssueFilters | undefined;
  appliedFilters: Partial<Record<TIssueParams, string | boolean>> | undefined;
  // action
  fetchFilters: (workspaceSlug: string, viewId: string) => Promise<void>;
  updateFilters: (
    workspaceSlug: string,
    projectId: string | undefined,
    filterType: EIssueFilterType,
    filters: IIssueFilterOptions | IIssueDisplayFilterOptions | IIssueDisplayProperties,
    viewId?: string | undefined
  ) => Promise<void>;
}

export class WorkspaceIssuesFilter extends IssueFilterHelperStore implements IWorkspaceIssuesFilter {
  // observables
  filters: { [viewId: string]: IIssueFilters } = {};
  // root store
  rootIssueStore;
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
    this.issueFilterService = new WorkspaceService();
  }

  get issueFilters() {
    const viewId = this.rootIssueStore.globalViewId;
    if (!viewId) return undefined;

    const displayFilters = this.filters[viewId] || undefined;
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

  fetchFilters = async (workspaceSlug: string, viewId: TWorkspaceFilters) => {
    try {
      let _filters: IIssueFiltersResponse;
      if (["all-issues", "assigned", "created", "subscribed"].includes(viewId))
        _filters = this.handleIssuesLocalFilters.get(EIssuesStoreType.GLOBAL, workspaceSlug, undefined, viewId);
      else _filters = await this.issueFilterService.getViewDetails(workspaceSlug, viewId);

      const filters: IIssueFilterOptions = this.computedFilters(_filters?.filters);
      const displayFilters: IIssueDisplayFilterOptions = this.computedDisplayFilters(_filters?.display_filters);
      const displayProperties: IIssueDisplayProperties = this.computedDisplayProperties(_filters?.display_properties);

      runInAction(() => {
        set(this.filters, [viewId, "filters"], filters);
        set(this.filters, [viewId, "displayFilters"], displayFilters);
        set(this.filters, [viewId, "displayProperties"], displayProperties);
      });
    } catch (error) {
      throw error;
    }
  };

  updateFilters = async (
    workspaceSlug: string,
    projectId: string | undefined,
    type: EIssueFilterType,
    filters: IIssueFilterOptions | IIssueDisplayFilterOptions | IIssueDisplayProperties,
    viewId: string | undefined = undefined
  ) => {
    try {
      if (!viewId) throw new Error("View id is required");

      if (isEmpty(this.filters) || isEmpty(this.filters[viewId]) || isEmpty(filters)) return;

      const _filters = {
        filters: this.filters[viewId].filters as IIssueFilterOptions,
        displayFilters: this.filters[viewId].displayFilters as IIssueDisplayFilterOptions,
        displayProperties: this.filters[viewId].displayProperties as IIssueDisplayProperties,
      };

      switch (type) {
        case EIssueFilterType.FILTERS:
          const updatedFilters = filters as IIssueFilterOptions;
          _filters.filters = { ..._filters.filters, ...updatedFilters };

          runInAction(() => {
            Object.keys(updatedFilters).forEach((_key) => {
              set(this.filters, [viewId, "filters", _key], updatedFilters[_key as keyof IIssueFilterOptions]);
            });
          });

          this.rootIssueStore.projectIssues.fetchIssues(workspaceSlug, viewId, "mutation");

          if (["all-issues", "assigned", "created", "subscribed"].includes(viewId))
            this.handleIssuesLocalFilters.set(EIssuesStoreType.GLOBAL, type, workspaceSlug, undefined, viewId, {
              filters: _filters.filters,
            });
          else
            await this.issueFilterService.updateView(workspaceSlug, viewId, {
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
                [viewId, "displayFilters", _key],
                updatedDisplayFilters[_key as keyof IIssueDisplayFilterOptions]
              );
            });
          });
          if (["all-issues", "assigned", "created", "subscribed"].includes(viewId))
            this.handleIssuesLocalFilters.set(EIssuesStoreType.GLOBAL, type, workspaceSlug, undefined, viewId, {
              display_filters: _filters.displayFilters,
            });
          else
            await this.issueFilterService.updateView(workspaceSlug, viewId, {
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
                [viewId, "displayProperties", _key],
                updatedDisplayProperties[_key as keyof IIssueDisplayProperties]
              );
            });
          });
          if (["all-issues", "assigned", "created", "subscribed"].includes(viewId))
            this.handleIssuesLocalFilters.set(EIssuesStoreType.GLOBAL, type, workspaceSlug, undefined, viewId, {
              display_properties: _filters.displayProperties,
            });
          else
            await this.issueFilterService.updateView(workspaceSlug, viewId, {
              display_properties: _filters.displayProperties,
            });
          break;
        default:
          break;
      }
    } catch (error) {
      if (viewId) this.fetchFilters(workspaceSlug, viewId);
      throw error;
    }
  };
}
