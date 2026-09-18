/**
 * ModelPicker — provider-rail model picker for the chat composer.
 * Dark theme, radix popover + tooltip, keyboard navigable, searchable.
 * Models come from the live vikey gateway (via /api/chat/models), grouped
 * by provider; capabilities chips (reasoning/image) are inferred.
 */
import { clsx, type ClassValue } from "clsx";
import {
  Brain,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Popover as PopoverPrimitive,
  Tooltip as TooltipPrimitive,
} from "radix-ui";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function Popover(props: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(props: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 flex w-72 flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

function TooltipProvider({
  delayDuration = 0,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  );
}

function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger(props: ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 inline-flex w-fit max-w-xs items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background",
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export type IconProps = SVGProps<SVGSVGElement>;

export function OpenAIIcon(props: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 260" fill="currentColor" {...props}>
      <path d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z" />
    </svg>
  );
}

export function ClaudeIcon(props: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 257" fill="#ffffff" {...props}>
      <path d="m50.228 170.321 50.357-28.257.843-2.463-.843-1.361h-2.462l-8.426-.518-28.775-.778-24.952-1.037-24.175-1.296-6.092-1.297L0 125.796l.583-3.759 5.12-3.434 7.324.648 16.202 1.101 24.304 1.685 17.629 1.037 26.118 2.722h4.148l.583-1.685-1.426-1.037-1.101-1.037-25.147-17.045-27.22-18.017-14.258-10.37-7.713-5.25-3.888-4.925-1.685-10.758 7-7.713 9.397.649 2.398.648 9.527 7.323 20.35 15.75L94.817 91.9l3.889 3.24 1.555-1.102.195-.777-1.75-2.917-14.453-26.118-15.425-26.572-6.87-11.018-1.814-6.61c-.648-2.723-1.102-4.991-1.102-7.778l7.972-10.823L71.42 0 82.05 1.426l4.472 3.888 6.61 15.101 10.694 23.786 16.591 32.34 4.861 9.592 2.592 8.879.973 2.722h1.685v-1.556l1.36-18.211 2.528-22.36 2.463-28.776.843-8.1 4.018-9.722 7.971-5.25 6.222 2.981 5.12 7.324-.713 4.73-3.046 19.768-5.962 30.98-3.889 20.739h2.268l2.593-2.593 10.499-13.934 17.628-22.036 7.778-8.749 9.073-9.657 5.833-4.601h11.018l8.1 12.055-3.628 12.443-11.342 14.388-9.398 12.184-13.48 18.147-8.426 14.518.778 1.166 2.01-.194 30.46-6.481 16.462-2.982 19.637-3.37 8.88 4.148.971 4.213-3.5 8.62-20.998 5.184-24.628 4.926-36.682 8.685-.454.324.519.648 16.526 1.555 7.065.389h17.304l32.21 2.398 8.426 5.574 5.055 6.805-.843 5.184-12.962 6.611-17.498-4.148-40.83-9.721-14-3.5h-1.944v1.167l11.666 11.406 21.387 19.314 26.767 24.887 1.36 6.157-3.434 4.86-3.63-.518-23.526-17.693-9.073-7.972-20.545-17.304h-1.36v1.814l4.73 6.935 25.017 37.59 1.296 11.536-1.814 3.76-6.481 2.268-7.13-1.297-14.647-20.544-15.1-23.138-12.185-20.739-1.49.843-7.194 77.448-3.37 3.953-7.778 2.981-6.48-4.925-3.436-7.972 3.435-15.749 4.148-20.544 3.37-16.333 3.046-20.285 1.815-6.74-.13-.454-1.49.194-15.295 20.999-23.267 31.433-18.406 19.702-4.407 1.75-7.648-3.954.713-7.064 4.277-6.286 25.47-32.405 15.36-20.092 9.917-11.6-.065-1.686h-.583L44.07 198.125l-12.055 1.555-5.185-4.86.648-7.972 2.463-2.593 20.35-13.999-.064.065Z" />
    </svg>
  );
}

export function GeminiIcon(props: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 296 298" fill="none" {...props}>
      <mask id="gem-mask" width="296" height="298" x="0" y="0" maskUnits="userSpaceOnUse" style={{ maskType: "alpha" }}>
        <path fill="#ffffff" d="M141.201 4.886c2.282-6.17 11.042-6.071 13.184.148l5.985 17.37a184.004 184.004 0 0 0 111.257 113.049l19.304 6.997c6.143 2.227 6.156 10.91.02 13.155l-19.35 7.082a184.001 184.001 0 0 0-109.495 109.385l-7.573 20.629c-2.241 6.105-10.869 6.121-13.133.025l-7.908-21.296a184 184 0 0 0-109.02-108.658l-19.698-7.239c-6.102-2.243-6.118-10.867-.025-13.132l20.083-7.467A183.998 183.998 0 0 0 133.291 26.28l7.91-21.394Z" />
      </mask>
      <g mask="url(#gem-mask)">
        <ellipse cx="163" cy="149" fill="#ffffff" rx="196" ry="159" opacity="0.9" />
        <ellipse cx="33.5" cy="142.5" fill="#ffffff" rx="68.5" ry="72.5" opacity="0.9" />
        <path fill="#ffffff" d="M194 10.5C172 82.5 65.5 134.333 22.5 135L144-66l50 76.5Z" opacity="0.85" />
        <path fill="#ffffff" d="M194.5 279.5C172.5 207.5 66 155.667 23 155l121.5 201 50-76.5Z" opacity="0.85" />
      </g>
    </svg>
  );
}

/** DeepSeek whale — simplified brand mark. */
export function DeepSeekIcon(props: IconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M23.85 5.53c-.3-.14-.43-.1-.6.02-.22.15-.47.33-.77.52-1.9 1.2-3.85 2.6-5.4 4.1-.3-.98-.83-2.2-1.62-3.34a.3.3 0 0 0-.5.02l-.03.05a7.61 7.61 0 0 0-.36 3.97c.02.15-.1.28-.26.28h-.66a13.7 13.7 0 0 1-8.4-2.97.31.31 0 0 0-.49.12c-.7 1.9-.53 4.13.62 5.9.55.85 1.29 1.63 2.2 2.26a12.2 12.2 0 0 1-3.4.72.3.3 0 0 0-.2.5c1.32 1.4 3.9 2.14 6.06 2.14h.17c2.66 0 5.15-1 6.85-2.8 2.02-2.13 3.02-5.17 2.82-8.6v-.13l1.75-1.3c.5-.37 1-.72 1.53-1.05l.63-.4a.3.3 0 0 0-.05-.53Z" />
    </svg>
  );
}

export type ModelCapability = "reasoning" | "image";

export type PickerModel = {
  id: string;
  name: string;
  description?: string;
  /** Defaults to true. False means the row is omitted from the list. */
  available?: boolean;
  capabilities?: readonly ModelCapability[];
};

export type PickerProvider = {
  id: string;
  name: string;
  icon?: ReactNode;
  models: PickerModel[];
};

export type ModelPickerProps = {
  providers: readonly PickerProvider[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (modelId: string, providerId: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  placeholder?: string;
  className?: string;
};

const CAPABILITY_LABEL: Record<ModelCapability, string> = {
  reasoning: "Reasoning",
  image: "Image",
};

const CAPABILITY_ICON: Record<ModelCapability, LucideIcon> = {
  reasoning: Brain,
  image: ImageIcon,
};

const CAPABILITY_ACCENT: Record<ModelCapability, string> = {
  reasoning: "text-white",
  image: "text-white",
};

function ProviderGlyph({
  provider,
  className,
}: {
  provider: PickerProvider;
  className?: string;
}) {
  if (provider.icon) {
    return (
      <span className={cn("inline-flex size-4 items-center justify-center [&>svg]:size-full", className)}>
        {provider.icon}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-4 items-center justify-center text-[11px] font-medium leading-none",
        className,
      )}
    >
      {provider.name.charAt(0)}
    </span>
  );
}

function CapabilityChips({
  capabilities,
}: {
  capabilities?: readonly ModelCapability[];
}) {
  if (!capabilities?.length) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-1 ring-1 ring-inset ring-border/70">
      {capabilities.map((capability, index) => {
        const Icon = CAPABILITY_ICON[capability];
        const label = CAPABILITY_LABEL[capability];
        return (
          <Fragment key={capability}>
            {index > 0 ? (
              <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border/70" />
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  aria-label={label}
                  className={cn(
                    "inline-flex size-4 items-center justify-center opacity-90 hover:opacity-100",
                    CAPABILITY_ACCENT[capability],
                  )}
                >
                  <Icon aria-hidden="true" className="size-3" strokeWidth={2} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {label}
              </TooltipContent>
            </Tooltip>
          </Fragment>
        );
      })}
    </span>
  );
}

function isAvailable(model: PickerModel) {
  return model.available !== false;
}

function visibleModels(provider: PickerProvider) {
  return provider.models.filter(isAvailable);
}

function visibleProviders(providers: readonly PickerProvider[]) {
  return providers.filter((provider) => visibleModels(provider).length > 0);
}

function matchesQuery(
  model: PickerModel,
  provider: PickerProvider,
  query: string,
) {
  return [model.name, model.id, model.description ?? "", provider.name].some(
    (field) => field.toLowerCase().includes(query),
  );
}

function findModel(
  providers: readonly PickerProvider[],
  modelId: string | undefined,
) {
  if (!modelId) return undefined;
  for (const provider of providers) {
    const model = provider.models.find((item) => item.id === modelId);
    if (model) return { provider, model };
  }
  return undefined;
}

export function ModelPicker({
  providers,
  value,
  defaultValue,
  onValueChange,
  open,
  defaultOpen = false,
  onOpenChange,
  side = "top",
  align = "start",
  placeholder = "Select a model",
  className,
}: ModelPickerProps) {
  const listId = useId();
  const rails = useMemo(() => visibleProviders(providers), [providers]);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedId = value ?? internalValue;
  const isOpen = open ?? internalOpen;
  const selected = findModel(providers, selectedId);

  const selectedProviderId = selected?.provider.id;

  const [activeProviderId, setActiveProviderId] = useState(
    () => findModel(providers, selectedId)?.provider.id ?? rails[0]?.id ?? "",
  );

  const [query, setQuery] = useState("");
  const search = query.trim().toLowerCase();
  const searching = search.length > 0;

  const activeProvider =
    rails.find((provider) => provider.id === activeProviderId) ?? rails[0];
  const rows = useMemo(() => {
    if (searching) {
      return rails.flatMap((provider) =>
        visibleModels(provider)
          .filter((model) => matchesQuery(model, provider, search))
          .map((model) => ({ provider, model })),
      );
    }
    if (!activeProvider) return [];
    return visibleModels(activeProvider).map((model) => ({
      provider: activeProvider,
      model,
    }));
  }, [activeProvider, rails, search, searching]);

  const activeModelIndex = Math.max(
    0,
    rows.findIndex((row) => row.model.id === selectedId),
  );

  const providerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const modelRefs = useRef<Array<HTMLElement | null>>([]);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen || searching) return;
    const index = rails.findIndex(
      (provider) => provider.id === selectedProviderId,
    );
    if (index < 0) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const button = providerRefs.current[index];
        const rail = railRef.current;
        if (!button || !rail) return;
        if (rail.scrollHeight <= rail.clientHeight) return;
        const offset =
          button.offsetTop - (rail.clientHeight - button.offsetHeight) / 2;
        rail.scrollTop = Math.max(0, offset);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [isOpen, rails, searching, selectedProviderId]);

  const changeOpen = useCallback(
    (next: boolean) => {
      setInternalOpen(next);
      onOpenChange?.(next);
      setQuery("");
      if (next) {
        const owner = findModel(providers, selectedId)?.provider.id;
        if (owner) setActiveProviderId(owner);
      }
    },
    [onOpenChange, providers, selectedId],
  );

  const selectModel = useCallback(
    (modelId: string, providerId: string) => {
      setInternalValue(modelId);
      onValueChange?.(modelId, providerId);
      changeOpen(false);
    },
    [changeOpen, onValueChange, providers],
  );

  function focusProvider(index: number) {
    const next = (index + rails.length) % rails.length;
    providerRefs.current[next]?.focus();
  }

  function focusModel(index: number) {
    if (rows.length === 0) return;
    const next = (index + rows.length) % rows.length;
    modelRefs.current[next]?.focus();
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusModel(0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const first = rows[0];
      if (first) selectModel(first.model.id, first.provider.id);
    } else if (event.key === "Escape" && query) {
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
    }
  }

  function onRailKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusProvider(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusProvider(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusProvider(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusProvider(rails.length - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusModel(0);
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusModel(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusModel(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusModel(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusModel(rows.length - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const railIndex =
        rails.findIndex((provider) => provider.id === activeProvider?.id);
      providerRefs.current[railIndex]?.focus();
    }
  }

  const triggerLabel = selected?.model.name ?? placeholder;

  return (
    <TooltipProvider delayDuration={250}>
      <Popover open={isOpen} onOpenChange={changeOpen}>
        <PopoverTrigger
          type="button"
          aria-label={triggerLabel}
          aria-haspopup="listbox"
          className={cn(
            "inline-flex h-9 max-w-full cursor-pointer touch-manipulation items-center gap-2 rounded-full bg-surface px-3 text-[13px] font-medium tracking-tight text-foreground ring-1 ring-inset ring-border/80 transition-colors hover:bg-muted/70 active:scale-[0.98] sm:px-3.5",
            className,
          )}
        >
          {selected ? (
            <span className="inline-flex size-5 shrink-0 items-center justify-center text-foreground">
              <ProviderGlyph provider={selected.provider} />
            </span>
          ) : null}
          <span className="min-w-0 truncate" translate="no">
            {triggerLabel}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 shrink-0 text-muted-foreground transition-transform data-[open=true]:rotate-180"
            data-open={isOpen}
          />
        </PopoverTrigger>
        <PopoverContent
          side={side}
          align={align}
          sideOffset={10}
          avoidCollisions={false}
          className="max-h-[min(26rem,80dvh)] w-[min(24rem,calc(100vw-1.5rem))] gap-0 overflow-hidden overscroll-contain rounded-xl p-0"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => {
              searchRef.current?.focus();
            });
          }}
        >
          {rails.length === 0 || !activeProvider ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">No models available</p>
          ) : (
            <div className="flex min-w-0 flex-col">
              <div className="flex min-h-52 bg-muted">
                {/* provider rail — vertical, out of flow so long lists scroll inside */}
                <div className="relative w-12 shrink-0 bg-muted">
                  <div
                    role="tablist"
                    aria-label="Providers"
                    aria-orientation="vertical"
                    ref={railRef}
                    className="absolute inset-0 flex flex-col gap-1.5 overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {rails.map((provider, index) => {
                      const selectedRail = provider.id === activeProvider.id;
                      return (
                        <Tooltip key={provider.id}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              role="tab"
                              id={`${listId}-tab-${provider.id}`}
                              aria-label={provider.name}
                              aria-selected={selectedRail}
                              aria-controls={listId}
                              tabIndex={selectedRail ? 0 : -1}
                              ref={(node) => {
                                providerRefs.current[index] = node;
                              }}
                              onClick={() => {
                                setQuery("");
                                setActiveProviderId(provider.id);
                              }}
                              onKeyDown={(event) => onRailKeyDown(event, index)}
                              className={cn(
                                "inline-flex size-9 shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-popover/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-10",
                                selectedRail &&
                                  !searching &&
                                  "bg-popover text-foreground ring-1 ring-inset ring-border/60",
                              )}
                            >
                              <ProviderGlyph provider={provider} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs" translate="no">
                            {provider.name}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  {/* search */}
                  <div className="flex shrink-0 items-center gap-2 bg-muted px-3 py-2">
                    <Search
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-muted-foreground"
                      strokeWidth={2}
                    />
                    <input
                      ref={searchRef}
                      type="text"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={onSearchKeyDown}
                      placeholder="Search models"
                      aria-label="Search models"
                      aria-controls={listId}
                      autoComplete="off"
                      spellCheck={false}
                      className="h-6 w-full min-w-0 bg-transparent text-sm tracking-tight text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
                    />
                    {query ? (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => {
                          setQuery("");
                          searchRef.current?.focus();
                        }}
                        className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-popover hover:text-foreground focus-visible:outline-none"
                      >
                        <X aria-hidden="true" className="size-3" strokeWidth={2} />
                      </button>
                    ) : null}
                  </div>
                  {/* model rows */}
                  <div
                    key={searching ? "search" : activeProvider.id}
                    className="flex min-w-0 flex-1 flex-col rounded-tl-lg bg-popover p-2"
                  >
                    <p
                      className="px-2.5 pb-1.5 pt-1 font-mono text-[11px] text-muted-foreground"
                      translate="no"
                    >
                      {searching
                        ? `${rows.length} ${rows.length === 1 ? "result" : "results"}`
                        : activeProvider.name}
                    </p>
                    <div
                      role="listbox"
                      id={listId}
                      aria-label={searching ? "Search results" : `${activeProvider.name} models`}
                      className="-mr-1 flex max-h-[min(16rem,42dvh)] min-w-0 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-1 [scrollbar-color:var(--color-border,#3a3a3a)_transparent] [scrollbar-width:thin]"
                    >
                      {rows.length === 0 ? (
                        <p
                          role="presentation"
                          className="px-2.5 py-6 text-center text-[11px] text-muted-foreground"
                        >
                          {`No models match "${query.trim()}"`}
                        </p>
                      ) : null}
                      {rows.map(({ provider, model }, index) => {
                        const isSelected = model.id === selectedId;
                        return (
                          <div
                            key={model.id}
                            role="option"
                            aria-selected={isSelected}
                            tabIndex={index === activeModelIndex ? 0 : -1}
                            ref={(node) => {
                              modelRefs.current[index] = node;
                            }}
                            onClick={() => selectModel(model.id, provider.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                selectModel(model.id, provider.id);
                                return;
                              }
                              onListKeyDown(event, index);
                            }}
                            className={cn(
                              "flex min-h-10 w-full min-w-0 cursor-pointer touch-manipulation items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isSelected && "bg-muted",
                            )}
                          >
                            {searching ? (
                              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-border/60">
                                <ProviderGlyph provider={provider} />
                              </span>
                            ) : null}
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="flex w-full min-w-0 items-center gap-1.5">
                                <span
                                  className="min-w-0 truncate text-[13px] font-medium tracking-tight"
                                  translate="no"
                                >
                                  {model.name}
                                </span>
                                {isSelected ? (
                                  <Check aria-hidden="true" className="size-3.5 shrink-0 text-foreground" />
                                ) : null}
                              </span>
                              {model.description ? (
                                <span className="w-full truncate text-[11px] leading-snug text-muted-foreground">
                                  {model.description}
                                </span>
                              ) : null}
                            </span>
                            <CapabilityChips capabilities={model.capabilities} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
