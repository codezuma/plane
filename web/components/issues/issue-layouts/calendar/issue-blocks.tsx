import { useState, useRef } from "react";
import { useRouter } from "next/router";
import { observer } from "mobx-react-lite";
import { Draggable } from "@hello-pangea/dnd";
import { MoreHorizontal } from "lucide-react";
// components
import { Tooltip } from "@plane/ui";
// hooks
import useOutsideClickDetector from "hooks/use-outside-click-detector";
// types
import { TIssue, TIssueMap } from "@plane/types";
import { useProject, useProjectState } from "hooks/store";

type Props = {
  issues: TIssueMap | undefined;
  issueIdList: string[] | null;
  quickActions: (issue: TIssue, customActionButton?: React.ReactElement) => React.ReactNode;
  showAllIssues?: boolean;
};

export const CalendarIssueBlocks: React.FC<Props> = observer((props) => {
  const { issues, issueIdList, quickActions, showAllIssues = false } = props;
  // router
  const router = useRouter();
  // hooks
  const { getProjectById } = useProject();
  const { getProjectStates } = useProjectState();
  // states
  const [isMenuActive, setIsMenuActive] = useState(false);

  const menuActionRef = useRef<HTMLDivElement | null>(null);

  const handleIssuePeekOverview = (issue: TIssue) => {
    const { query } = router;

    router.push({
      pathname: router.pathname,
      query: { ...query, peekIssueId: issue?.id, peekProjectId: issue?.project_id },
    });
  };

  useOutsideClickDetector(menuActionRef, () => setIsMenuActive(false));

  const customActionButton = (
    <div
      ref={menuActionRef}
      className={`w-full cursor-pointer rounded p-1 text-custom-sidebar-text-400 hover:bg-custom-background-80 ${
        isMenuActive ? "bg-custom-background-80 text-custom-text-100" : "text-custom-text-200"
      }`}
      onClick={() => setIsMenuActive(!isMenuActive)}
    >
      <MoreHorizontal className="h-3.5 w-3.5" />
    </div>
  );

  return (
    <>
      {issueIdList?.slice(0, showAllIssues ? issueIdList.length : 4).map((issueId, index) => {
        if (!issues?.[issueId]) return null;

        const issue = issues?.[issueId];
        return (
          <Draggable key={issue.id} draggableId={issue.id} index={index}>
            {(provided, snapshot) => (
              <div
                className="relative cursor-pointer p-1 px-2"
                {...provided.draggableProps}
                {...provided.dragHandleProps}
                ref={provided.innerRef}
                onClick={() => handleIssuePeekOverview(issue)}
              >
                {issue?.tempId !== undefined && (
                  <div className="absolute left-0 top-0 z-[99999] h-full w-full animate-pulse bg-custom-background-100/20" />
                )}

                <div
                  className={`group/calendar-block flex h-8 w-full items-center justify-between gap-1.5 rounded border-[0.5px] border-custom-border-100 px-1 py-1.5 shadow-custom-shadow-2xs ${
                    snapshot.isDragging
                      ? "bg-custom-background-90 shadow-custom-shadow-rg"
                      : "bg-custom-background-100 hover:bg-custom-background-90"
                  }`}
                >
                  <div className="flex h-full items-center gap-1.5">
                    <span
                      className="h-full w-0.5 flex-shrink-0 rounded"
                      style={{
                        backgroundColor: getProjectStates(issue?.project_id).find(
                          (state) => state?.id == issue?.state_id
                        )?.color,
                      }}
                    />
                    <div className="flex-shrink-0 text-xs text-custom-text-300">
                      {getProjectById(issue?.project_id)?.identifier}-{issue.sequence_id}
                    </div>
                    <Tooltip tooltipHeading="Title" tooltipContent={issue.name}>
                      <div className="truncate text-xs">{issue.name}</div>
                    </Tooltip>
                  </div>
                  <div
                    className={`hidden h-5 w-5 group-hover/calendar-block:block ${isMenuActive ? "!block" : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    {quickActions(issue, customActionButton)}
                  </div>
                </div>
              </div>
            )}
          </Draggable>
        );
      })}
    </>
  );
});
