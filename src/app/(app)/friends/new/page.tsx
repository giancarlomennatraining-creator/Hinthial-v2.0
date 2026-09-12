"use client";

import { RequireMasterKey } from "@/components/crypto/RequireMasterKey";
import { CreateFriendForm } from "@/components/friends/CreateFriendForm";

export default function NewFriendPage() {
  return <RequireMasterKey>{(masterKey) => <CreateFriendForm masterKey={masterKey} />}</RequireMasterKey>;
}
