import type { SVGProps } from "react";

/** BOBAR's b monogram with two teeth cut out of the bowl. */
export function BrandMark({ movingTeeth = false, eyes = false, ...props }: SVGProps<SVGSVGElement> & { movingTeeth?: boolean; eyes?: boolean }) {
  return (
    <svg
      viewBox="0 0 240 280"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path
        fillRule="evenodd"
        d={"M20 10h22c32 0 53 21 53 53v27c13-5 27-7 42-7 60 0 99 42 99 97s-42 96-105 96C60 276 20 232 20 165V10Z" + (movingTeeth ? "" : "m83 190v32h23v-32h-23Zm32 0v32h23v-32h-23Z")}
        clipRule="evenodd"
      />
      {eyes && (
        <g className="mascot-eyes">
          {[105, 160].map((x) => (
            <g className="mascot-eye" key={x}>
              <circle cx={x} cy="166" r="20" fill="var(--background)" />
              <circle className="mascot-pupil" cx={x} cy="166" r="10" />
            </g>
          ))}
        </g>
      )}
      {movingTeeth && (
        <g className="hero-teeth" fill="var(--background)">
          <rect x="103" y="200" width="23" height="32" />
          <rect x="135" y="200" width="23" height="32" />
        </g>
      )}
    </svg>
  );
}

export function Brand() {
  return (
    <a className="brand" href="#top" aria-label="BOBAR – на главную">
      <BrandMark />
      <span>BOBAR</span>
    </a>
  );
}
