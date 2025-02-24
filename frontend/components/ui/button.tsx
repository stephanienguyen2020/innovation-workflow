import React from "react"

interface ButtonProps extends React.ComponentPropsWithoutRef<"button"> {
  variant?: "default" | "outline"
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", asChild = false, ...props }, ref) => {
    const Component = asChild ? "a" : "button"
    return (
      <Component
        className={`
          ${
            variant === "outline"
              ? "border border-gray-200 bg-transparent hover:bg-gray-100"
              : "bg-blue-500 text-white hover:bg-blue-700"
          }
          ${className || ""}
        `}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button }

