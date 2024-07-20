import * as React from "react";
import { useRef } from "react";

type Props = {
  val: number;
  minVal: number;
  maxVal: number;
  onChange: (value: number) => void;
  step?: number;
  id?: string;
};
export default function SliderInput(props: Props) {
  const { val, minVal, maxVal, onChange } = props;
  let { step, id } = props;
  if (step === undefined || step === null) {
    step = 1;
  }

  if (!id) {
    id = "slider-input";
  }
  const ref = useRef<HTMLOutputElement>(null);

  const initialPixelVal = ((val - minVal) / (maxVal - minVal)) * 100;

  const handleChange = (event: React.FormEvent<HTMLInputElement>) => {
    const v = parseInt(event.currentTarget.value);

    onChange(v);
    const newVal = ((v - minVal) / (maxVal - minVal)) * 100;
    ref.current!.style.left = `calc(${newVal}% + (${7.5 - newVal * 0.15}px))`;
  };

  return (
    <span>
      <span className="slider-input-min-max-label">{minVal}</span>
      <div className="slider-input-wrapper">
        <input
          type="range"
          className="slider-input-range"
          name={id}
          min={minVal}
          max={maxVal}
          step={step}
          value={val}
          onChange={handleChange}
          list={`${id}-tickmarks`}
        />
        {step !== null && step !== undefined && (
          <datalist id={`${id}-tickmarks`}>
            {Array.from({ length: (maxVal - minVal) / step + 1 }).map(
              (_, i) => {
                const val = minVal + i * step!;
                return (
                  <option
                    key={i}
                    value={val}
                    label={
                      val == minVal || val == maxVal
                        ? val.toString()
                        : undefined
                    }
                  />
                );
              }
            )}
          </datalist>
        )}
        <output
          className="slider-input-bubble"
          htmlFor={id}
          ref={ref}
          style={{
            left: `calc(${initialPixelVal}% + (${
              7.5 - initialPixelVal * 0.15
            }px))`,
          }}
        >
          {val}
        </output>
      </div>
      <span className="slider-input-min-max-label">{maxVal}</span>
    </span>
  );
}
