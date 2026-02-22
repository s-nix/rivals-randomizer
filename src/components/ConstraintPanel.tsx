"use client";

import { RandomizerOptions, DEFAULT_OPTIONS } from "@/lib/randomizer";
import { Role } from "@/data/heroes";

interface ConstraintPanelProps {
  options: RandomizerOptions;
  onOptionsChange: (options: RandomizerOptions) => void;
}

const ROLES: Role[] = ["Vanguard", "Duelist", "Strategist"];

export default function ConstraintPanel({
  options,
  onOptionsChange,
}: ConstraintPanelProps) {
  const toggle = (key: keyof Pick<RandomizerOptions, "noDuplicates" | "roleConstraints" | "crossTeamUnique">) => {
    onOptionsChange({ ...options, [key]: !options[key] });
  };

  const setRoleCount = (role: Role, count: number) => {
    onOptionsChange({
      ...options,
      roleCounts: { ...options.roleCounts, [role]: Math.max(0, count) },
    });
  };

  const totalRoleSlots = Object.values(options.roleCounts).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-4">
      <h3 className="text-lg font-bold text-white">Constraints</h3>

      {/* No Duplicates */}
      <label className="flex items-center justify-between cursor-pointer group">
        <div>
          <p className="text-white font-medium group-hover:text-gray-300 transition-colors">
            No duplicate heroes
          </p>
          <p className="text-gray-500 text-sm">
            Each hero assigned to at most one player per team
          </p>
        </div>
        <ToggleSwitch
          checked={options.noDuplicates}
          onChange={() => toggle("noDuplicates")}
        />
      </label>

      {/* Cross-team unique (only visible when noDuplicates is on) */}
      {options.noDuplicates && (
        <label className="flex items-center justify-between cursor-pointer group ml-4">
          <div>
            <p className="text-white font-medium group-hover:text-gray-300 transition-colors">
              Cross-team unique
            </p>
            <p className="text-gray-500 text-sm">
              No hero appears on both teams
            </p>
          </div>
          <ToggleSwitch
            checked={options.crossTeamUnique}
            onChange={() => toggle("crossTeamUnique")}
          />
        </label>
      )}

      {/* Role constraints */}
      <label className="flex items-center justify-between cursor-pointer group">
        <div>
          <p className="text-white font-medium group-hover:text-gray-300 transition-colors">
            Role-based composition
          </p>
          <p className="text-gray-500 text-sm">
            Enforce a specific number of each role per team
          </p>
        </div>
        <ToggleSwitch
          checked={options.roleConstraints}
          onChange={() => toggle("roleConstraints")}
        />
      </label>

      {/* Role count pickers */}
      {options.roleConstraints && (
        <div className="ml-4 space-y-2">
          {ROLES.map((role) => (
            <div key={role} className="flex items-center gap-3">
              <RoleBadge role={role} />
              <span className="text-gray-300 text-sm flex-1">{role}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setRoleCount(role, options.roleCounts[role] - 1)
                  }
                  className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 text-white
                             flex items-center justify-center transition-colors text-sm"
                >
                  −
                </button>
                <span className="w-6 text-center text-white font-mono">
                  {options.roleCounts[role]}
                </span>
                <button
                  onClick={() =>
                    setRoleCount(role, options.roleCounts[role] + 1)
                  }
                  className="w-7 h-7 rounded bg-gray-700 hover:bg-gray-600 text-white
                             flex items-center justify-center transition-colors text-sm"
                >
                  +
                </button>
              </div>
            </div>
          ))}
          <p
            className={`text-xs mt-1 ${
              totalRoleSlots === 6 ? "text-gray-500" : "text-yellow-400"
            }`}
          >
            Total: {totalRoleSlots} slots per team
            {totalRoleSlots !== 6 && " (standard is 6)"}
          </p>
        </div>
      )}

      {/* Reset */}
      <button
        onClick={() => onOptionsChange(DEFAULT_OPTIONS)}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
      >
        Reset to defaults
      </button>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault();
        onChange();
      }}
      className={`
        relative w-11 h-6 rounded-full transition-colors shrink-0
        ${checked ? "bg-blue-500" : "bg-gray-600"}
      `}
    >
      <span
        className={`
          absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full
          transition-transform shadow-sm
          ${checked ? "translate-x-5" : "translate-x-0"}
        `}
      />
    </button>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const colors: Record<Role, string> = {
    Vanguard: "bg-blue-500/20 text-blue-400",
    Duelist: "bg-red-500/20 text-red-400",
    Strategist: "bg-green-500/20 text-green-400",
  };
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full ${
        role === "Vanguard"
          ? "bg-blue-400"
          : role === "Duelist"
          ? "bg-red-400"
          : "bg-green-400"
      }`}
    />
  );
}
