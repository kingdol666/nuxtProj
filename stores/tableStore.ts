import { defineStore } from 'pinia';
import tableData from '~/data/formData.json';

interface User {
  key: string;
  name: string;
  age: number;
  address: string;
}

export const useTableStore = defineStore('table', {
  state: (): { data: User[] } => ({
    data: tableData,
  }),
  actions: {
    deleteRecord(key: string) {
      this.data = this.data.filter(item => item.key !== key);
    },
    updateRecord(updatedRecord: User) {
      const index = this.data.findIndex(item => item.key === updatedRecord.key);
      if (index !== -1) {
        this.data[index] = updatedRecord;
      }
    },
    addRecord(newRecord: Omit<User, 'key'>) {
      const newKey = (Math.max(...this.data.map(u => parseInt(u.key, 10))) + 1).toString();
      this.data.push({ ...newRecord, key: newKey });
    }
  },
});
