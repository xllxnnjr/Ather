import React from 'react';

interface AtherLogoMarkProps {
  className?: string;
  imgScaleClass?: string;
  alt?: string;
}

export const AtherLogoMark: React.FC<AtherLogoMarkProps> = ({
  className = 'w-10 h-10 rounded-xl',
  imgScaleClass = 'scale-[1.72]',
  alt = 'Ather',
}) => {
  return (
    <div
      className={`relative overflow-hidden bg-black border border-[#242429] shrink-0 select-none ${className}`}
    >
      <img
        src="/assets/aistudio/image_6ac665d7.png"
        alt={alt}
        draggable={false}
        className={`w-full h-full object-cover object-center ${imgScaleClass}`}
      />
    </div>
  );
};
