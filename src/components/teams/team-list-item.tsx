
"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TeamData } from "@/types";
import { DefaultTeamLogo } from "./default-team-logo";
import { Users, ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface TeamListItemProps {
  team: TeamData;
  categoryName: string;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (teamId: string) => void;
}

export function TeamListItem({ team, categoryName, isSelectionMode = false, isSelected = false, onToggleSelection }: TeamListItemProps) {
  const handleCardInteraction = (e: React.MouseEvent) => {
    if (isSelectionMode && onToggleSelection) {
      e.preventDefault(); 
      onToggleSelection(team.id);
    }
  };
  
  const cardContent = (
    <Card 
        className={cn(
            "hover:shadow-lg transition-shadow duration-200 h-full flex flex-col relative",
            isSelectionMode && "cursor-pointer",
            isSelected && isSelectionMode && "ring-2 ring-destructive border-destructive"
        )}
        onClick={isSelectionMode ? handleCardInteraction : undefined}
    >
      {isSelectionMode && (
          <div className="absolute top-2 left-2 z-20 p-1 bg-background/70 rounded-sm">
              <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => {
                      if (onToggleSelection) {
                          onToggleSelection(team.id);
                      }
                  }}
                  aria-label={`Seleccionar ${team.name} para eliminar`}
                  id={`select-team-${team.id}`}
                  className="h-5 w-5 data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground data-[state=checked]:border-destructive"
              />
          </div>
      )}
      {categoryName && (
        <Badge variant="outline" className="absolute top-2 right-2 text-xs whitespace-nowrap z-10 bg-card/80">
          <ListFilter className="mr-1 h-3 w-3" />
          {categoryName}
        </Badge>
      )}
      <CardHeader className="flex-row items-start gap-4 pb-3 pt-3">
        {team.logoDataUrl ? (
          <Image
            src={team.logoDataUrl} 
            alt={`${team.name} logo`}
            width={48}
            height={48}
            className="rounded-md object-contain w-12 h-12"
          />
        ) : (
          <DefaultTeamLogo teamName={team.name} size="md" />
        )}
        <div className="flex-1 min-w-0">
          <CardTitle className="text-xl font-semibold text-primary-foreground truncate pr-4">
            {team.name}
          </CardTitle>
          {team.subName && (
            <p className="text-sm text-muted-foreground truncate pr-4 -mt-0.5" title={team.subName}>
              {team.subName}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow pt-2 pb-4 flex flex-col justify-end">
        <div className="text-sm text-muted-foreground flex items-center">
          <Users className="mr-2 h-4 w-4" />
          <span>{team.players.length} Jugador{team.players.length !== 1 ? 'es' : ''}</span>
        </div>
      </CardContent>
    </Card>
  );

  if (isSelectionMode) {
    return <div>{cardContent}</div>;
  }

  return (
    <Link href={`/teams/${team.id}`} className="contents">
      {cardContent}
    </Link>
  );
}
