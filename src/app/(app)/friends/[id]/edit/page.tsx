"use client";

import { use } from "react";
import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { EditFriendForm } from "@/components/friends/EditFriendForm";

export default function EditFriendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RequireMasterKey>{(masterKey) => <EditFriendForm masterKey={masterKey} friendId={id} />}</RequireMasterKey>
  );
}
