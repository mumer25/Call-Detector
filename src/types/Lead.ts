export type Lead = {
  id: string;
  name: string;
  phone: string;
  status: "NEW" | "OLD" | "Interested" | "Not Interested" | "Follow Up";
  assignee?: string;
  source?: "fb" | "jd" | "web";
};
