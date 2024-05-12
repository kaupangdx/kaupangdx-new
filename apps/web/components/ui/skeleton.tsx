import { cn } from "@/lib/utils";

function Skeleton({
  className,
  loading,
  invisible,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  invisible?: boolean;
  loading: boolean;
}) {
  return (
    <div className={cn({ "": loading })}>
      <div
        className={cn(
          // "relative -top-1 mb-1",
          {
            "animate-pulse rounded-md bg-muted": loading && !invisible,
          },
          className,
        )}
        {...props}
      >
        <div
          className={cn({
            "opacity-0": loading,
          })}
        >
          {props.children}
        </div>
      </div>
    </div>
  );
}

export { Skeleton };
