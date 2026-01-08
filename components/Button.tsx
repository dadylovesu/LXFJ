import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isActive?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  isActive = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center font-sans font-bold transition-all duration-300 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider";
  
  const variants = {
    primary: "bg-zinc-800/90 hover:bg-zinc-700 text-white border border-zinc-600/50 backdrop-blur-sm",
    secondary: "bg-transparent text-zinc-200 hover:text-white border border-dashed border-zinc-600 hover:border-zinc-400",
    ghost: "bg-transparent text-zinc-200 hover:text-white hover:bg-white/10",
    accent: "bg-cine-accent text-black font-black hover:brightness-110 shadow-[0_0_15px_-3px_rgba(255,122,0,0.3)] hover:shadow-[0_0_20px_rgba(255,122,0,0.5)] border border-cine-accent",
    icon: "bg-transparent text-white hover:bg-white/10 rounded-full"
  };

  const activeStyles = isActive ? "bg-zinc-700 text-white border-white shadow-inner ring-1 ring-cine-accent/40" : "";
  
  const sizes = {
    sm: "text-[11px] px-4 py-2 rounded-sm",
    md: "text-[12px] px-5 py-2.5 rounded-[2px]",
    lg: "text-[14px] px-7 py-3.5 rounded-md",
    icon: "p-2.5 rounded-md"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${activeStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};