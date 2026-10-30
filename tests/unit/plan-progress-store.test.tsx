import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { publishPlanProgress, usePlanProgress } from "@/lib/plan-progress-store";

afterEach(() => {
  act(() => publishPlanProgress(null));
});

describe("plan-progress-store", () => {
  it("parte vuoto e si aggiorna quando 'Oggi' pubblica l'avanzamento", () => {
    const { result } = renderHook(() => usePlanProgress());
    expect(result.current).toBeNull();

    act(() => publishPlanProgress({ done: 4, total: 9 }));
    expect(result.current).toEqual({ done: 4, total: 9 });

    act(() => publishPlanProgress({ done: 5, total: 9 }));
    expect(result.current).toEqual({ done: 5, total: 9 });
  });

  it("al blocco si svuota", () => {
    const { result } = renderHook(() => usePlanProgress());
    act(() => publishPlanProgress({ done: 2, total: 9 }));
    act(() => publishPlanProgress(null));
    expect(result.current).toBeNull();
  });

  it("chi si iscrive dopo vede l'ultimo valore", () => {
    act(() => publishPlanProgress({ done: 3, total: 9 }));
    const { result } = renderHook(() => usePlanProgress());
    expect(result.current).toEqual({ done: 3, total: 9 });
  });
});
