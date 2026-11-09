import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { LotteryWorkspace, localLotteryTime } from "@/features/admin/lottery";
import { adminFetch } from "@/features/admin/client";
vi.mock("@/features/admin/client", () => ({ adminFetch: vi.fn() }));
beforeEach(() => { vi.mocked(adminFetch).mockReset(); vi.mocked(adminFetch).mockResolvedValue({ items: [], total: 0 }); });
test("hora de lotería admite segundos sin cambiar la zona dominicana",()=>{
 expect(localLotteryTime("2026-11-01T14:30:21")).toBe("2026-11-01T18:30:21.000Z");
 expect(localLotteryTime("2026-11-01T14:30")).toBe("2026-11-01T18:30:00.000Z");
 expect(()=>localLotteryTime("fecha incorrecta")).toThrow();
});
test("ADMIN consulta historial pero no registra resultados ni entregas", async () => {
 render(<LotteryWorkspace id="test" role="ADMIN" />);
 await screen.findByText("No hay registros.");
 expect(screen.queryByRole("button", { name: "Registrar resultado y buscar boleto" })).not.toBeInTheDocument();
});
test("resultado manual de un único campo conserva ceros y referencia", async () => {
 render(<LotteryWorkspace id="test" role="OWNER" />);
 await screen.findByText("No hay registros.");
 fireEvent.change(screen.getByLabelText("Número ganador (cinco cifras)"), { target: { value: "00120" } });
 fireEvent.change(screen.getByLabelText("Fecha y hora del evento (Santo Domingo)"), { target: { value: "2026-11-01T14:30" } });
 fireEvent.change(screen.getByLabelText("Edición, horario y referencia verificable del resultado"), { target: { value: "EDICION DEMO" } });
 const button=screen.getByRole("button", { name: "Registrar resultado y buscar boleto" });
 fireEvent.submit(button.closest("form")!);
 await screen.findByText("Registro guardado. El historial se conserva.");
 const call=vi.mocked(adminFetch).mock.calls.find(([,init])=>init?.method==='POST');
 expect(call).toBeDefined();
 expect(JSON.parse(String(call![1]!.body))).toMatchObject({ action:"RESULT",pick4:"0012",fireball:"0",reference:"EDICION DEMO",eventAt:"2026-11-01T18:30:00.000Z" });
 expect(call![1]!.headers).toHaveProperty("Idempotency-Key");
});
test("errores de registro se muestran sin afirmar éxito",async()=>{
 vi.mocked(adminFetch).mockImplementation(async (_url,init)=>{if(init?.method==='POST')throw Error('Operación rechazada');return {items:[],total:0};});
 render(<LotteryWorkspace id="test" role="OWNER" />);await screen.findByText("No hay registros.");
 fireEvent.change(screen.getByLabelText("Premio principal o secundario"),{target:{value:'DEMO'}});
 fireEvent.submit(screen.getByRole('button',{name:'Guardar premio de lotería'}).closest('form')!);
 await waitFor(()=>expect(screen.getByText('Operación rechazada')).toBeInTheDocument());
 expect(screen.queryByText('Registro guardado. El historial se conserva.')).not.toBeInTheDocument();
});
