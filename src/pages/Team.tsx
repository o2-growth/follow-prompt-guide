import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users2 } from "lucide-react";

const AREAS = [
  { key: "commercial", label: "Comercial" },
  { key: "ops", label: "Operações" },
  { key: "finance", label: "Finanças" },
  { key: "product", label: "Produto" },
];

export default function Team() {
  const [area, setArea] = useState("commercial");
  const { data: roles = [] } = useQuery({
    queryKey: ["role_templates"],
    queryFn: async () => (await supabase.from("role_templates").select("*")).data ?? [],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users2 className="h-7 w-7 text-accent" />
        <div>
          <h1 className="font-serif text-3xl font-bold text-primary">Estrutura de time</h1>
          <p className="text-muted-foreground">Organograma recomendado e frameworks por área.</p>
        </div>
      </div>

      <Tabs value={area} onValueChange={setArea}>
        <TabsList>{AREAS.map(a => <TabsTrigger key={a.key} value={a.key}>{a.label}</TabsTrigger>)}</TabsList>
        {AREAS.map(a => (
          <TabsContent key={a.key} value={a.key} className="space-y-4 mt-4">
            {roles.filter(r => r.area === a.key).map(r => (
              <Card key={r.id} className="shadow-soft">
                <CardHeader>
                  <CardTitle className="font-serif flex items-baseline justify-between flex-wrap gap-2">
                    <span>{r.role_name}</span>
                    {r.framework_key && <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-medium">{r.framework_key}</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {r.description && <p>{r.description}</p>}
                  {r.framework_summary && (
                    <div className="text-muted-foreground border-l-2 border-accent/40 pl-3 italic">{r.framework_summary}</div>
                  )}
                </CardContent>
              </Card>
            ))}
            {!roles.filter(r => r.area === a.key).length && (
              <div className="text-muted-foreground text-center py-12 border-2 border-dashed rounded-xl">Catálogo em construção para esta área.</div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
