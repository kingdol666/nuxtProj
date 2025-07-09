<template>
  <div class="page-container">
    <h1>用户数据</h1>
    <div class="table-container">
      <a-button @click="handleAdd" type="primary" style="margin-bottom: 16px">
        Add a row
      </a-button>
      <a-table :columns="columns" :data-source="dataSource" class="custom-table" :pagination="{ pageSize: 5 }">
        <template #bodyCell="{ column, text, record }">
          <template v-if="['name', 'age', 'address'].includes(column.dataIndex) && editableData[record.key]">
            <a-input v-if="column.dataIndex !== 'age'" v-model:value="editableData[record.key][column.dataIndex]" style="margin: -5px 0" />
            <a-input-number v-else v-model:value="editableData[record.key][column.dataIndex]" style="margin: -5px 0" />
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="editable-row-operations">
              <span v-if="editableData[record.key]">
                <a @click="save(record.key)">Save</a>
                <a-popconfirm title="Sure to cancel?" @confirm="cancel(record.key)">
                  <a>Cancel</a>
                </a-popconfirm>
              </span>
              <span v-else>
                <a @click="edit(record.key)">Edit</a>
                <a-popconfirm title="Sure to delete?" @confirm="onDelete(record.key)">
                  <a>Delete</a>
                </a-popconfirm>
              </span>
            </div>
          </template>
        </template>
      </a-table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useTableStore } from '~/stores/tableStore';
import { storeToRefs } from 'pinia';
import { Table as ATable, Space as ASpace, Popconfirm as APopconfirm, Button as AButton, Input as AInput, InputNumber as AInputNumber } from 'ant-design-vue';

const tableStore = useTableStore();
const { data: dataSource } = storeToRefs(tableStore);
const { deleteRecord, updateRecord, addRecord } = tableStore;

const columns = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Age', dataIndex: 'age', key: 'age' },
  { title: 'Address', dataIndex: 'address', key: 'address' },
  { title: 'Action', key: 'action' },
];

const editableData = reactive({});

const edit = key => {
  editableData[key] = { ...dataSource.value.find(item => key === item.key) };
};

const save = key => {
  updateRecord(editableData[key]);
  delete editableData[key];
};

const cancel = key => {
  delete editableData[key];
};

const onDelete = key => {
  deleteRecord(key);
};

const handleAdd = () => {
  const newRecord = {
    name: 'New User',
    age: 25,
    address: 'New Address',
  };
  addRecord(newRecord);
};
</script>

<style scoped>
.page-container {
  padding: 40px;
  background: linear-gradient(to right, #f8f9fa, #e9ecef);
  min-height: 100vh;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

h1 {
  text-align: center;
  margin-bottom: 30px;
  color: #495057;
  font-weight: 300;
  font-size: 2.5rem;
}

.table-container {
  background: #ffffff;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  border: 1px solid #dee2e6;
}

:deep(.custom-table .ant-table-thead > tr > th) {
  background-color: #f8f9fa;
  color: #495057;
  font-weight: 600;
  text-align: left;
  border-bottom: 2px solid #dee2e6;
  padding: 16px;
}

:deep(.custom-table .ant-table-tbody > tr > td) {
  padding: 16px;
  border-bottom: 1px solid #f1f1f1;
  color: #6c757d;
}

:deep(.custom-table .ant-table-tbody > tr:hover > td) {
  background-color: #f8f9fa;
}

.editable-row-operations a {
  margin-right: 8px;
}

:deep(.custom-table a) {
  color: #007bff;
  transition: color 0.3s;
}

:deep(.custom-table a:hover) {
  color: #0056b3;
}
</style>
