import React from "react";
import { Dropdown } from "./dropdown";
import { TransportMode } from "../core/SidePanel";

interface TransportModeDropdownProps {
  value: TransportMode;
  onChange: (value: TransportMode) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled: boolean;
}

const transportModeOptions: { value: TransportMode; label: string }[] = [
  { value: "driving-car", label: "Voiture" },
  { value: "cycling-road", label: "Vélo de route" },
  { value: "cycling-mountain", label: "VTT" },
  { value: "cycling-electric", label: "Vélo Electrique" },
  { value: "foot-walking", label: "Marche" },
  { value: "foot-hiking", label: "Randonnée" },
  { value: "wheelchair", label: "Fauteuil roulant" },
];

export function TransportModeDropdown({
  value,
  onChange,
  className,
  style,
  disabled,
}: TransportModeDropdownProps) {
  return (
    <Dropdown
      disabled={disabled}
      options={transportModeOptions}
      value={value}
      onChange={(newValue) => onChange(newValue as TransportMode)}
      placeholder="Sélectionner un mode de transport"
      className={className}
      style={style}
    />
  );
}
