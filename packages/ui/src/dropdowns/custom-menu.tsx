import * as React from "react";

// react-poppper
import { usePopper } from "react-popper";
// hooks
import { useDropdownKeyDown } from "../hooks/use-dropdown-key-down";
import useOutsideClickDetector from "../hooks/use-outside-click-detector";
// headless ui
import { Menu } from "@headlessui/react";
// type
import { ICustomMenuDropdownProps, ICustomMenuItemProps } from "./helper";
// icons
import { ChevronDown, MoreHorizontal } from "lucide-react";

const CustomMenu = (props: ICustomMenuDropdownProps) => {
  const {
    buttonClassName = "",
    customButtonClassName = "",
    placement,
    children,
    className = "",
    customButton,
    disabled = false,
    ellipsis = false,
    label,
    maxHeight = "md",
    noBorder = false,
    noChevron = false,
    optionsClassName = "",
    verticalEllipsis = false,
    width = "auto",
    menuButtonOnClick,
    tabIndex,
  } = props;

  const [referenceElement, setReferenceElement] = React.useState<HTMLButtonElement | null>(null);
  const [popperElement, setPopperElement] = React.useState<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  // refs
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);

  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: placement ?? "auto",
  });

  const openDropdown = () => {
    setIsOpen(true);
    if (referenceElement) referenceElement.focus();
  };
  const closeDropdown = () => setIsOpen(false);
  const handleKeyDown = useDropdownKeyDown(openDropdown, closeDropdown, isOpen);
  useOutsideClickDetector(dropdownRef, closeDropdown);

  return (
    <Menu
      as="div"
      ref={dropdownRef}
      tabIndex={tabIndex}
      className={`relative w-min text-left ${className}`}
      onKeyDown={handleKeyDown}
    >
      {({ open }) => (
        <>
          {customButton ? (
            <Menu.Button as={React.Fragment}>
              <button
                ref={setReferenceElement}
                type="button"
                onClick={() => {
                  openDropdown();
                  if (menuButtonOnClick) menuButtonOnClick();
                }}
                className={customButtonClassName}
              >
                {customButton}
              </button>
            </Menu.Button>
          ) : (
            <>
              {ellipsis || verticalEllipsis ? (
                <Menu.Button as={React.Fragment}>
                  <button
                    ref={setReferenceElement}
                    type="button"
                    onClick={() => {
                      openDropdown();
                      if (menuButtonOnClick) menuButtonOnClick();
                    }}
                    disabled={disabled}
                    className={`relative grid place-items-center rounded p-1 text-custom-text-200 outline-none hover:text-custom-text-100 ${
                      disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-custom-background-80"
                    } ${buttonClassName}`}
                  >
                    <MoreHorizontal className={`h-3.5 w-3.5 ${verticalEllipsis ? "rotate-90" : ""}`} />
                  </button>
                </Menu.Button>
              ) : (
                <Menu.Button as={React.Fragment}>
                  <button
                    ref={setReferenceElement}
                    type="button"
                    className={`flex items-center justify-between gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs duration-300 ${
                      open ? "bg-custom-background-90 text-custom-text-100" : "text-custom-text-200"
                    } ${noBorder ? "" : "border border-custom-border-300 shadow-sm focus:outline-none"} ${
                      disabled
                        ? "cursor-not-allowed text-custom-text-200"
                        : "cursor-pointer hover:bg-custom-background-80"
                    } ${buttonClassName}`}
                    onClick={() => {
                      openDropdown();
                      if (menuButtonOnClick) menuButtonOnClick();
                    }}
                  >
                    {label}
                    {!noChevron && <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </Menu.Button>
              )}
            </>
          )}
          {isOpen && (
            <Menu.Items className="fixed z-10" static>
              <div
                className={`my-1 overflow-y-scroll whitespace-nowrap rounded-md border border-custom-border-300 bg-custom-background-90 p-1 text-xs shadow-custom-shadow-rg focus:outline-none ${
                  maxHeight === "lg"
                    ? "max-h-60"
                    : maxHeight === "md"
                      ? "max-h-48"
                      : maxHeight === "rg"
                        ? "max-h-36"
                        : maxHeight === "sm"
                          ? "max-h-28"
                          : ""
                } ${width === "auto" ? "min-w-[8rem] whitespace-nowrap" : width} ${optionsClassName}`}
                ref={setPopperElement}
                style={styles.popper}
                {...attributes.popper}
              >
                {children}
              </div>
            </Menu.Items>
          )}
        </>
      )}
    </Menu>
  );
};

const MenuItem: React.FC<ICustomMenuItemProps> = (props) => {
  const { children, onClick, className = "" } = props;
  return (
    <Menu.Item as="div">
      {({ active, close }) => (
        <button
          type="button"
          className={`w-full select-none truncate rounded px-1 py-1.5 text-left text-custom-text-200 hover:bg-custom-background-80 ${
            active ? "bg-custom-background-80" : ""
          } ${className}`}
          onClick={(e) => {
            close();
            onClick && onClick(e);
          }}
        >
          {children}
        </button>
      )}
    </Menu.Item>
  );
};

CustomMenu.MenuItem = MenuItem;

export { CustomMenu };
