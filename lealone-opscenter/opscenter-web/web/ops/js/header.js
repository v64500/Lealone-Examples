﻿const opsHeader = { 
    data() {
        return {
            autoCommit: true
        }
    },
    methods: {
        setAutoCommit() {
            var result = "Auto commit is now " + (this.autoCommit ? "ON" : "OFF");
            // ql=@autocommit_' + (document.header.autoCommit.checked ? 'true' : 'false') + '.'
            this.router.route('ops', 'result', {result: result});
        },
        login() {
            var that = this;
            axios.post(OpsCenter.OpsService + '/login', { url: this.url, user: this.user, password: this.password })
            .then(function (response) {
                console.log(response.data);
                // that.router.route("ops", "header");
                that.router.route("ops", "tables");
                // location.href = "/";
            })
            .catch(function (error) {
                console.log(error);
                that.errorMessage = "用户名或密码不正确,请重新输入";
            });
        },
        logout() {
            localStorage.removeItem("currentUser");
            axios.get(OpsCenter.OpsService + '/logout')
            .then(function (response) {
                location.href = "/ops/index.html";
            });
        },
        refreshTables() {
            this.router.route('ops', 'result', "refreshTables: TODO");
        },
        commit() {
            this.router.route('ops', 'result', "query sql=COMMIT: TODO");
        },
        rollback() {
            this.router.route('ops', 'result', "query sql=ROLLBACK: TODO");
        }
    },
    mounted() {
        this.router.set(this.gid, this);
        axios.get(OpsCenter.OpsService + '/get_language_combo')
        .then(response => {
			this.languages = response.data;
		});
    }
}
